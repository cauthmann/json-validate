/**
 * See README.md for documentation.
 */
export declare type ErrorMap = Record<string, string>;
export declare type ValidatorResult = boolean | string | ErrorMap;
export declare type Validator = (v: any) => ValidatorResult;
export declare type Schema = Validator | // custom functions
RegExp | // validates strings
null | string | number | boolean | // compare against primitive values
Schema[] | // a tuple
[
    Schema
] | [Schema, number] | [Schema, number, number] | // an array, optionally with min and max length
{
    [key: string]: Schema;
};
/**
 * Validates a value against a schema.
 *
 * @param {any} schema
 * @param {any} value
 * @returns {true|object} true if value matches the schema, otherwise an object with error messages keyed by path
 * @throws if the schema is invalid or the schema throws
 */
export default function validateJSON(schema: Schema, value: any): true | ErrorMap;
export declare function boolean(v: unknown): v is boolean;
export declare function number(v: unknown): v is number;
export declare function integer(v: unknown): v is number;
export declare function string(v: unknown): v is string;
export declare function array(v: unknown): v is Array<unknown>;
export declare function plain_array(v: unknown): v is Array<unknown>;
export declare function object(v: unknown): v is Record<string, unknown>;
export declare function object(required_properties: Record<string, Schema>, optional_properties: Record<string, Schema> | null, min_optional_properties?: number, max_optional_properties?: number): Validator;
export declare function plain_object(v: unknown): v is Record<string, unknown>;
export declare function plain_object(required_properties: Record<string, Schema>, optional_properties: Record<string, Schema> | null, min_optional_properties?: number, max_optional_properties?: number): Validator;
export declare function partial_object(properties: Record<string, Schema>): Validator;
export declare function tuple(...schemata: Schema[]): Validator;
export declare function map(key_schema: Schema, value_schema: Schema, min_entries?: number, max_entries?: number): Validator;
export declare function and(...schemata: Schema[]): Validator;
export declare function and_all(...schemata: Schema[]): Validator;
export declare function or(...schemata: Schema[]): Validator;
