/** Expenses — integer-paise expense records with created-by metadata. */
import { Inject, Injectable } from "@nestjs/common";
import { COLLECTIONS, type ExpenseDoc, type ExpenseUpsertDto, type AuthPrincipal } from "@annaadhya/contracts";
import { notFound, type DataClient } from "@annaadhya/data-core";
import { newId } from "@annaadhya/utils";
import { DATA_CLIENT } from "../../data/data.module";

@Injectable()
export class ExpensesService {
  constructor(@Inject(DATA_CLIENT) private readonly data: DataClient) {}

  async list(filters: { from?: number; to?: number; category?: string } = {}): Promise<ExpenseDoc[]> {
    const where: { field: string; op: "==" | ">=" | "<="; value: unknown }[] = [];
    if (filters.from) where.push({ field: "date", op: ">=", value: filters.from });
    if (filters.to) where.push({ field: "date", op: "<=", value: filters.to });
    if (filters.category) where.push({ field: "category", op: "==", value: filters.category });
    return this.data.list<ExpenseDoc>(COLLECTIONS.expenses, {
      where,
      orderBy: [{ field: "date", direction: "desc" }],
      limit: 1000,
    });
  }

  async get(id: string): Promise<ExpenseDoc> {
    const doc = await this.data.get<ExpenseDoc>(COLLECTIONS.expenses, id);
    if (!doc) throw notFound("Expense not found");
    return doc;
  }

  async create(dto: ExpenseUpsertDto, actor: AuthPrincipal): Promise<ExpenseDoc> {
    return this.data.create<ExpenseDoc>(
      COLLECTIONS.expenses,
      {
        date: dto.date,
        category: dto.category,
        amountPaise: dto.amountPaise,
        description: dto.description,
        payee: dto.payee,
        reference: dto.reference,
        attachmentUrl: dto.attachmentUrl,
        createdByUid: actor.uid,
        createdByName: actor.displayName,
      } as object as ExpenseDoc,
      { id: newId("exp") },
    );
  }

  async update(id: string, dto: ExpenseUpsertDto): Promise<ExpenseDoc> {
    await this.get(id);
    await this.data.update(COLLECTIONS.expenses, id, {
      date: dto.date,
      category: dto.category,
      amountPaise: dto.amountPaise,
      description: dto.description,
      payee: dto.payee,
      reference: dto.reference,
      attachmentUrl: dto.attachmentUrl,
    } as Partial<ExpenseDoc>);
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    await this.data.delete(COLLECTIONS.expenses, id);
  }

  async total(filters: { from?: number; to?: number } = {}): Promise<number> {
    const rows = await this.list(filters);
    return rows.reduce((sum, e) => sum + e.amountPaise, 0);
  }
}
