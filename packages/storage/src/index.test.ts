import { describe, expect, it } from 'vitest';
import {
  createInMemoryReleaseStorage,
  ReleaseObjectAlreadyExistsError,
  ReleaseObjectNotFoundError,
} from './index';

describe('createInMemoryReleaseStorage', () => {
  it('reporta headObject inexistente sem lançar', async () => {
    const storage = createInMemoryReleaseStorage();
    await expect(storage.headObject('android/releases/0.1.0/x.apk')).resolves.toStrictEqual({
      exists: false,
    });
  });

  it('grava um objeto ausente e passa a reportá-lo no head', async () => {
    const storage = createInMemoryReleaseStorage();
    const body = Buffer.from('conteudo-apk');
    await storage.putObjectIfAbsent('k', body, 'application/vnd.android.package-archive');
    const info = await storage.headObject('k');
    expect(info.exists).toBe(true);
    expect(info.size).toBe(body.byteLength);
  });

  it('bloqueia sobrescrita de objeto existente (imutabilidade de release)', async () => {
    const storage = createInMemoryReleaseStorage();
    await storage.putObjectIfAbsent('k', Buffer.from('v1'), 'text/plain');
    await expect(
      storage.putObjectIfAbsent('k', Buffer.from('v2'), 'text/plain'),
    ).rejects.toBeInstanceOf(ReleaseObjectAlreadyExistsError);
    await expect(storage.getObject('k')).resolves.toStrictEqual(Buffer.from('v1'));
  });

  it('getObject de chave inexistente lança ReleaseObjectNotFoundError', async () => {
    const storage = createInMemoryReleaseStorage();
    await expect(storage.getObject('nao-existe')).rejects.toBeInstanceOf(
      ReleaseObjectNotFoundError,
    );
  });

  it('deleteObject remove o objeto e permite regravação (usado apenas para rollback de publicação falha)', async () => {
    const storage = createInMemoryReleaseStorage();
    await storage.putObjectIfAbsent('k', Buffer.from('v1'), 'text/plain');
    await storage.deleteObject('k');
    await expect(storage.headObject('k')).resolves.toStrictEqual({ exists: false });
    await storage.putObjectIfAbsent('k', Buffer.from('v2'), 'text/plain');
    await expect(storage.getObject('k')).resolves.toStrictEqual(Buffer.from('v2'));
  });

  it('listKeys filtra por prefixo', async () => {
    const storage = createInMemoryReleaseStorage();
    await storage.putObjectIfAbsent('android/releases/0.1.0/apk', Buffer.from('a'), 'text/plain');
    await storage.putObjectIfAbsent('android/releases/0.1.1/apk', Buffer.from('b'), 'text/plain');
    await storage.putObjectIfAbsent('android/latest.json', Buffer.from('{}'), 'application/json');
    const keys = await storage.listKeys('android/releases/');
    expect(keys.sort()).toStrictEqual(['android/releases/0.1.0/apk', 'android/releases/0.1.1/apk']);
  });

  it('presignGetObject falha para objeto inexistente e retorna URL com expiração para objeto existente', async () => {
    const storage = createInMemoryReleaseStorage();
    await expect(storage.presignGetObject('k', 60)).rejects.toBeInstanceOf(
      ReleaseObjectNotFoundError,
    );
    await storage.putObjectIfAbsent('k', Buffer.from('v1'), 'text/plain');
    const url = await storage.presignGetObject('k', 60);
    expect(url).toContain('k');
    expect(url).toContain('60');
  });
});
