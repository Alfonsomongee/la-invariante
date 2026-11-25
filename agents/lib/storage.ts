import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getEnv, ROOT_DIR } from './env.js';

export interface StoredDocument {
  url: string;
  sha256: string;
  capturado: string;
  contentType: string;
  bytes: number;
  localPath: string;
  manifestPath: string;
  r2Uploaded: boolean;
  r2Key?: string;
  waybackUrl: string | null;
}

export function sha256Hex(buffer: Buffer | Uint8Array | string): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * Sube un documento primario a Cloudflare R2 (API compatible S3 con firma AWS SigV4)
 * usando únicamente `node:crypto` y `fetch` nativos. Nombre de objeto = sha256.
 */
export async function uploadToR2(
  sha256: string,
  body: Buffer,
  contentType: string,
): Promise<{ uploaded: boolean; key?: string; reason?: string }> {
  const accountId = getEnv('R2_ACCOUNT_ID');
  const bucket = getEnv('R2_BUCKET');
  const accessKeyId = getEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('R2_SECRET_ACCESS_KEY');

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return { uploaded: false, reason: 'Credenciales R2 no configuradas; guardado solo en caché local (.cache/docs/).' };
  }

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const key = sha256;
  const canonicalUri = `/${bucket}/${key}`;
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256; // body SHA-256 ya calculado
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const resp = await fetch(`https://${host}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization,
    },
    body: new Uint8Array(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Error subiendo objeto ${key} a Cloudflare R2 (${resp.status}): ${errText}`);
  }

  return { uploaded: true, key };
}

/**
 * Archiva la URL pública en la Wayback Machine (Internet Archive) si está disponible.
 */
export async function archiveInWayback(url: string): Promise<string | null> {
  try {
    const saveUrl = `https://web.archive.org/save/${url}`;
    const resp = await fetch(saveUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'user-agent': 'LaInvariante-Bot/1.0 (+https://lainvariante.es)' },
    });
    const contentLocation = resp.headers.get('content-location') ?? resp.headers.get('location');
    if (contentLocation) {
      return contentLocation.startsWith('http')
        ? contentLocation
        : `https://web.archive.org${contentLocation}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Guarda documento binario en .cache/docs/ (excluido de Git), calcula SHA-256,
 * sube a R2 si hay credenciales y opcionalmente archiva en Wayback Machine.
 */
export async function storeRawDocument(params: {
  url: string;
  buffer: Buffer;
  contentType: string;
  sourceName: string;
  anio?: number;
  metadata?: Record<string, unknown>;
  archiveWayback?: boolean;
  skipR2?: boolean;
}): Promise<StoredDocument> {
  const hash = sha256Hex(params.buffer);
  const capturado = todayIsoDate();
  const docsDir = path.join(ROOT_DIR, '.cache', 'docs');
  const manifestsDir = path.join(ROOT_DIR, '.cache', 'manifests');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(manifestsDir, { recursive: true });

  const localPath = path.join(docsDir, hash);
  fs.writeFileSync(localPath, params.buffer);

  let r2Uploaded = false;
  let r2Key: string | undefined;
  if (!params.skipR2) {
    const r2 = await uploadToR2(hash, params.buffer, params.contentType);
    r2Uploaded = r2.uploaded;
    r2Key = r2.key;
  }

  const waybackUrl = params.archiveWayback ? await archiveInWayback(params.url) : null;

  const manifest: StoredDocument & {
    sourceName: string;
    anio?: number;
    metadata?: Record<string, unknown>;
  } = {
    url: params.url,
    sha256: hash,
    capturado,
    contentType: params.contentType,
    bytes: params.buffer.length,
    localPath,
    manifestPath: path.join(manifestsDir, `${hash}.json`),
    r2Uploaded,
    r2Key,
    waybackUrl,
    sourceName: params.sourceName,
    anio: params.anio,
    metadata: params.metadata,
  };

  fs.writeFileSync(manifest.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}
