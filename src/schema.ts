import { z } from 'zod';

export type Schema<T = unknown> = z.ZodType<T>;
export type InferOutput<T extends z.ZodType> = z.infer<T>;

type AnySchema = z.ZodType;
type SchemaAction = (schema: AnySchema) => AnySchema;

const applyActions = <S extends AnySchema>(
  schema: S,
  actions: readonly SchemaAction[]
): AnySchema => actions.reduce<AnySchema>((current, action) => action(current), schema);

const expectNumberSchema = (schema: AnySchema, actionName: string): z.ZodNumber => {
  if (schema instanceof z.ZodNumber) return schema;
  throw new TypeError(`${actionName} can only be applied to a number schema.`);
};

const expectStringSchema = (schema: AnySchema, actionName: string): z.ZodString => {
  if (schema instanceof z.ZodString) return schema;
  throw new TypeError(`${actionName} can only be applied to a string schema.`);
};

export const description =
  (value: string): SchemaAction =>
  (schema) =>
    schema.describe(value);

export const gte =
  (value: number): SchemaAction =>
  (schema) =>
    expectNumberSchema(schema, 'gte').min(value);

export const lte =
  (value: number): SchemaAction =>
  (schema) =>
    expectNumberSchema(schema, 'lte').max(value);

export const min =
  (value: number): SchemaAction =>
  (schema) =>
    expectStringSchema(schema, 'min').min(value);

export const int: SchemaAction = (schema) => expectNumberSchema(schema, 'int').int();

export const str = (...actions: readonly SchemaAction[]): z.ZodString =>
  applyActions(z.string(), actions) as z.ZodString;

export const num = (...actions: readonly SchemaAction[]): z.ZodNumber =>
  applyActions(z.number(), actions) as z.ZodNumber;

export const bool = (...actions: readonly SchemaAction[]): z.ZodBoolean =>
  applyActions(z.boolean(), actions) as z.ZodBoolean;

export const array = <S extends AnySchema>(
  schema: S,
  ...actions: readonly SchemaAction[]
): z.ZodArray<S> => applyActions(z.array(schema), actions) as z.ZodArray<S>;

export const object = <Shape extends z.ZodRawShape>(
  shape: Shape,
  ...actions: readonly SchemaAction[]
): z.ZodObject<Shape> => applyActions(z.object(shape), actions) as z.ZodObject<Shape>;

export const optional = <S extends AnySchema>(schema: S): z.ZodOptional<S> => schema.optional();

export const union = <Schemas extends readonly [AnySchema, AnySchema, ...AnySchema[]]>(
  ...schemas: Schemas
): z.ZodUnion<Schemas> => z.union(schemas);

const formatIssuePath = (path: readonly PropertyKey[]): string =>
  path.length > 0 ? path.map((part) => String(part)).join('.') : '<root>';

const formatZodError = (error: z.ZodError): string =>
  error.issues.map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`).join('; ');

export const safeParse =
  <S extends AnySchema>(schema: S) =>
  (
    input: unknown
  ):
    | {
        success: true;
        data: z.infer<S>;
      }
    | {
        success: false;
        error: string;
      } => {
    const result = schema.safeParse(input);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: formatZodError(result.error) };
  };
