import { describe, expect, it } from 'vitest';
import {
  canonicalMoney,
  civilDate,
  fingerprints,
  mapCsv,
  normalizeDescription,
  parseCsvCells,
  parseOfx,
  sanitizeFilename,
} from './imports.helpers';

describe('normalização segura de importações', () => {
  it('normaliza descrição de modo versionável e sanitiza basename', () => {
    expect(normalizeDescription('  CAFÉ___São   Paulo <x> ')).toBe('café são paulo x');
    expect(sanitizeFilename('../../extrato\u0000.ofx')).toBe('extrato.ofx');
    expect(sanitizeFilename('..\\..\\conta.csv')).toBe('conta.csv');
  });
  it('preserva Decimal exato e rejeita zero, overflow e notação científica', () => {
    expect(canonicalMoney('1234.56')).toBe('1234.56');
    expect(canonicalMoney('0.00')).toBeNull();
    expect(canonicalMoney('1e2')).toBeNull();
    expect(canonicalMoney('100000000000000000.00')).toBeNull();
  });
  it('valida datas civis sem shift', () => {
    expect(civilDate('2024-02-29')).toBe('2024-02-29');
    expect(civilDate('2023-02-29')).toBeNull();
  });
  it('produz fingerprints determinísticos e separa janela de data', () => {
    const base = {
      userId: 'u',
      accountId: 'a',
      format: 'OFX' as const,
      externalId: 'ID-1',
      date: '2026-08-10',
      type: 'EXPENSE',
      amount: '10.00',
      description: 'Mercado',
    };
    const first = fingerprints(base),
      moved = fingerprints({ ...base, date: '2026-08-11' });
    expect(first.strongKeyHash).toBe(moved.strongKeyHash);
    expect(first.exactFingerprint).not.toBe(moved.exactFingerprint);
    expect(first.windowFingerprint).toBe(moved.windowFingerprint);
  });
});

describe('parsers aprovados pela SPEC-021', () => {
  it('mapeia CSV sem float e com separadores explícitos', () => {
    const cells = parseCsvCells(
      Buffer.from('\uFEFFdata;texto;valor\n31/12/2025;Mercado;-1.234,56\n'),
      ';',
    );
    const [row] = mapCsv(cells, {
      version: 1,
      delimiter: ';',
      header: true,
      dateFormat: 'DD/MM/YYYY',
      decimalSeparator: ',',
      thousandsSeparator: '.',
      columns: { date: 0, description: 1, amount: 2 },
    });
    expect(row).toMatchObject({
      date: '2025-12-31',
      amount: '1234.56',
      type: 'EXPENSE',
      blocked: false,
    });
  });
  it('rejeita mapping decimal ambíguo', () => {
    expect(() =>
      mapCsv([['2026-01-01', 'x', '1,00']], {
        version: 1,
        delimiter: ',',
        header: false,
        dateFormat: 'YYYY-MM-DD',
        decimalSeparator: ',',
        thousandsSeparator: ',',
        columns: { date: 0, description: 1, amount: 2 },
      }),
    ).toThrow('INVALID_CSV_MAPPING');
  });
  it('normaliza OFX 1 SGML e conserva a data declarada', () => {
    const source = `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260813120000[-3:BRT]<TRNAMT>-10.25<FITID>A1<NAME>Mercado<MEMO>Compra</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    expect(parseOfx(Buffer.from(source))[0]).toMatchObject({
      date: '2026-08-13',
      amount: '10.25',
      type: 'EXPENSE',
      externalId: 'A1',
      blocked: false,
    });
  });
  it('bloqueia DTD, XXE e XInclude antes da biblioteca', () => {
    for (const unsafe of [
      '<!DOCTYPE OFX SYSTEM "file:///etc/passwd"><OFX/>',
      '<!ENTITY x SYSTEM "http://example.test/x"><OFX/>',
      '<OFX><xi:include href="file:///x"/></OFX>',
    ])
      expect(() => parseOfx(Buffer.from(unsafe))).toThrow('UNSAFE_OFX');
  });
  it('rejeita UTF-8 inválido', () => {
    expect(() => parseCsvCells(Buffer.from([0xff, 0xfe]), ',')).toThrow();
  });
});
