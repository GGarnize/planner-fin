import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateCardPurchaseDto } from '../card-purchases/dto';
import { PayCardInvoiceDto } from '../card-invoices/dto';
import { CreateCardDto } from './dto';
import { CardPurchasesService } from '../card-purchases/card-purchases.service';

const purchase = (date: string) =>
  Object.assign(new CreateCardPurchaseDto(), {
    cardId: '11111111-1111-4111-8111-111111111111',
    categoryId: '22222222-2222-4222-8222-222222222222',
    description: 'Compra fictícia',
    purchaseDate: date,
    totalAmount: '10.00',
    installmentCount: 1,
  });

describe('validação HTTP de cartões', () => {
  it('aceita data bissexta real e rejeita datas gregorianas inexistentes', async () => {
    expect(await validate(purchase('2028-02-29'))).toHaveLength(0);
    expect(await validate(purchase('2027-02-29'))).not.toHaveLength(0);
    expect(await validate(purchase('2026-02-31'))).not.toHaveLength(0);
  });

  it('rejeita data de pagamento inexistente', async () => {
    const dto = Object.assign(new PayCardInvoiceDto(), {
      accountId: '33333333-3333-4333-8333-333333333333',
      paymentDate: '2026-02-31',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejeita limite de crédito zero na fronteira', async () => {
    const dto = Object.assign(new CreateCardDto(), {
      name: 'Cartão fictício',
      creditLimit: '0.00',
      closingDay: 10,
      dueDay: 17,
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejeita data civil inexistente nos filtros antes de consultar o banco', async () => {
    const service = new CardPurchasesService({} as never, { jwtSecret: 'secret' } as never);
    await expect(service.list('owner', { dateFrom: '2026-02-31' })).rejects.toMatchObject({
      status: 400,
    });
  });
});
