
/**
 * See README.md for documentation.
 */

const DEBUG = process.env.NODE_ENV === 'development';

export type ErrorMap = Record<string, string>;
export type ValidatorResult = boolean | string | ErrorMap;
export type Validator = (v: any) => ValidatorResult;
export type Schema =
	Validator | // custom functions
	RegExp | // validates strings
	null | string | number | boolean | // compare against primitive values
	Schema[] | // a tuple
	[Schema] | [Schema, number] | [Schema, number, number] | // an array, optionally with min and max length
	//Record<string, Schema> // doesn't work, see https://github.com/microsoft/TypeScript/issues/41164
	{ [key: string]: Schema } // object by example
;

/**
 * Validates a value against a schema.
 *
 * @param {any} schema
 * @param {any} value
 * @returns {true|object} true if value matches the schema, otherwise an object with error messages keyed by path
 * @throws if the schema is invalid or the schema throws
 */
export default function validateJSON(schema: Schema, value: any): true | ErrorMap {
	// Passing a mutable object around is a bit more efficient than creating and merging objects at each step.
	// We do not want to complicate the public API, but we'll use this optimization internally.
	let errors = {};
	validate2(schema, value, '', errors);
	if (object_has_a_property(errors))
		return errors;

	return true;
}

function validate2(schema: Schema, value: unknown, path: string, errors: ErrorMap) {
	// Schema as a function
	if (typeof schema === 'function') {
		let res = schema(value);
		merge_result(errors, path, res);
		return;
	}
	// RegExp
	if (schema instanceof RegExp) {
		if (!string(value)) {
			errors[path] = DEBUG ? `Expected string` : '';
			return;
		}
		if (value.search(schema) < 0) {
			errors[path] = DEBUG ? `String value does not match regexp` : '';
		}
		return;
	}
	// null
	if (schema === null || string(schema) || number(schema) || boolean(schema)) {
		if (value !== schema) {
			errors[path] = DEBUG ? `Expected ${JSON.stringify(schema)}` : '';
		}
		return;
	}
	// Array by example
	if (plain_array(schema)) {
		if (!array(value)) {
			errors[path] = DEBUG ? `Expected array` : '';
			return;
		}
		if (schema.length < 1 || schema.length > 3) {
			throw new Error(`Invalid schema at path '${path}': arrays must be of length 1 to 3`);
		}
		let min = 0, max = Number.MAX_SAFE_INTEGER;
		if (schema.length > 1) {
			if (!integer(schema[1]) || schema[1] < 0) {
				throw new Error(`Invalid schema at path '${path}': array[0] must be a non-negative integer`);
			}
			min = schema[1];
		}
		if (schema.length > 2) {
			if (!integer(schema[2]) || schema[2] < 0) {
				throw new Error(`Invalid schema at path '${path}': array[0] must be a non-negative integer`);
			}
			max = schema[2];
		}
		if (value.length < min || value.length > max) {
			errors[path] = DEBUG ? `Array not of expected length: ${min} <= ${value.length} <= ${max}` : '';
		}
		for (let i = 0; i < value.length; i++) {
			validate2(schema[0], value[i], `${path}[${i}]`, errors);
		}
		return;
	}
	// Object by example
	if (is_plain_object(schema)) {
		value = value as Record<string, unknown>;
		if (!is_object(value)) {
			errors[path] = DEBUG ? `Expected object` : '';
			return;
		}
		for (let prop in value) {
			if (!schema.hasOwnProperty(prop)) {
				errors[path] = DEBUG ? `Unexpected property: ${prop}` : '';
				return;
			}
		}
		for (let prop in schema) {
			let subpath = `${path}.${prop}`;
			if (!value.hasOwnProperty(prop) || value[prop] === undefined) {
				errors[subpath] = DEBUG ? `Missing property` : '';
				continue;
			}
			validate2(schema[prop], value[prop], subpath, errors);
		}
		return;
	}

	throw new Error(`Invalid schema at path '${path}'`);
}


// Merges a result from a subpath into an error object
function merge_result(errors: ErrorMap, path: string, result: ValidatorResult) {
	if (result === true)
		return;
	if (result === false) {
		errors[path] = '';
		return;
	}
	if (string(result)) {
		errors[path] = result;
		return;
	}
	if (object(result)) {
		for (let subpath in result) {
			errors[path + subpath] = result[subpath];
		}
		return;
	}
	throw new Error(`Invalid schema result encountered`);
}

// Validators for basic JSON types
export function boolean(v: unknown): v is boolean {
	return typeof v === 'boolean';
}
export function number(v: unknown): v is number {
	return Number.isFinite(v);
}
export function integer(v: unknown): v is number {
	return Number.isInteger(v);
}
export function string(v: unknown): v is string {
	return typeof v === 'string';
}
export function array(v: unknown): v is Array<unknown> {
	if (!Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype)
		return false;
	return true;
}
export function plain_array(v: unknown): v is Array<unknown> {
	if (!array(v))
		return false;
	if (Object.getOwnPropertySymbols(v).length > 0)
		return false;
	let length = v.length;
	if (!integer(length) || length < 0)
		return false;
	let ownPropertyNames = Object.getOwnPropertyNames(v);
	for (let prop of ownPropertyNames) {
		let desc = Object.getOwnPropertyDescriptor(v, prop)!;
		if (desc.get !== undefined || desc.set !== undefined) {
			return false;
		}
		if (prop === 'length')
			continue;
		if (desc.enumerable !== true) {
			return false;
		}
		// We do not care about writable or configurable. Frozen schemata or values should work just fine.

		// But we need to make sure all names are numeric
		let idx = Number(prop);
		if (!integer(idx) || idx < 0 || idx >= length)
			return false;
	}
	// We also need to make sure that we have exactly (length + 1) properties
	if (ownPropertyNames.length !== length + 1)
		return false;
	return true;
}
function is_object(v: unknown): v is Record<string, unknown> {
	if (typeof v !== 'object' || v === null || Object.getPrototypeOf(v) !== Object.prototype)
		return false;
	return true;
}
function is_plain_object(v: unknown): v is Record<string, unknown> {
	if (!is_object(v))
		return false;
	if (Object.getOwnPropertySymbols(v).length > 0)
		return false;
	for (let prop of Object.getOwnPropertyNames(v)) {
		let desc = Object.getOwnPropertyDescriptor(v, prop)!;
		if (desc.get !== undefined || desc.set !== undefined) {
			return false;
		}
		if (desc.enumerable !== true) {
			return false;
		}
		// We do not care about writable or configurable. Frozen schemata or values should work just fine.
	}
	return true;
}

export function object(v: unknown): v is Record<string, unknown>;
export function object(required_properties: Record<string, Schema>, optional_properties: Record<string, Schema> | null, min_optional_properties?: number, max_optional_properties?: number): Validator;
export function object(...args: [unknown] | [Record<string, Schema>, Record<string, Schema>|null, number?, number?]): boolean | Validator {
	if (args.length === 1) {
		let value = args[0];
		return is_object(value);
	}

	if (args.length < 1 || args.length > 4) {
		throw new Error(`object: wrong number of arguments`);
	}
	let [required_properties, optional_properties = null, min_optional_properties = 0, max_optional_properties = Number.MAX_SAFE_INTEGER] = args;
	if (!is_plain_object(required_properties) || !is_plain_object(optional_properties)) {
		throw new Error('Invalid schema');
	}
	// Do this check just once when creating the schema.
	for (let prop in required_properties) {
		if (optional_properties.hasOwnProperty(prop)) {
			throw new Error(`Invalid schema: property ${prop} must not be both required and optional`);
		}
	}

	return (value: unknown) => {
		if (!is_object(value)) {
			return DEBUG ? 'Expected object' : '';
		}

		for (let prop in value) {
			if (!required_properties.hasOwnProperty(prop) && (optional_properties === null || !optional_properties.hasOwnProperty(prop))) {
				return DEBUG ? `Unexpected property: ${prop}` : '';
			}
		}

		let errors: ErrorMap = {};
		for (let prop in required_properties) {
			let path = `.${prop}`;
			if (!value.hasOwnProperty(prop) || value[prop] === undefined) {
				errors[path] = DEBUG ? `Missing property ${prop}` : '';
				continue;
			}
			validate2(required_properties[prop], value[prop], path, errors);
		}
		let optional_property_count = 0;
		for (let prop in optional_properties) {
			let path = `.${prop}`;
			if (!value.hasOwnProperty(prop)) {
				continue;
			}
			optional_property_count++;
			validate2(optional_properties[prop], value[prop], path, errors);
		}
		if (optional_property_count < min_optional_properties || optional_property_count > max_optional_properties) {
			errors[''] = DEBUG ? 'Wrong number of optional properties' : '';
		}
		return errors;
	}
}

export function plain_object(v: unknown): v is Record<string, unknown>;
export function plain_object(required_properties: Record<string, Schema>, optional_properties: Record<string, Schema> | null, min_optional_properties?: number, max_optional_properties?: number): Validator;
export function plain_object(...args: [unknown] | [Record<string, Schema>, Record<string, Schema>|null, number?, number?]): boolean | Validator {
	if (args.length === 1) {
		let value = args[0];
		return is_plain_object(value);
	}

	let schema = object(...args);
	return (value: unknown) => {
		if (!is_plain_object(value))
			return DEBUG ? 'Expected plain object' : '';
		return schema(value);
	}
}

// This will ignore any properties not specified. Useful to combine with and_all() etc
export function partial_object(properties: Record<string, Schema>): Validator {
	if (!is_plain_object(properties)) {
		throw new Error('Invalid schema');
	}

	return (value: unknown) => {
		if (!is_object(value)) {
			return DEBUG ? 'Expected object' : '';
		}

		let errors: ErrorMap = {};
		for (let prop in properties) {
			let path = `.${prop}`;
			if (!value.hasOwnProperty(prop) || value[prop] === undefined) {
				errors[path] = DEBUG ? `Missing property ${prop}` : '';
				continue;
			}
			validate2(properties[prop], value[prop], path, errors);
		}
		return errors;
	}
}

export function tuple(...schemata: Schema[]): Validator {
	if (schemata.length < 1) {
		throw new Error('Invalid schema: tuple needs at least one schema');
	}

	return (value: unknown) => {
		if (!array(value)) {
			return DEBUG ? 'Expected array' : false;
		}
		if (value.length !== schemata.length) {
			return DEBUG ? `Unexpected length of tuple, got ${value.length}, expected ${schemata.length}` : false;
		}

		let errors: ErrorMap = {};
		for (let i = 0; i < schemata.length; i++) {
			validate2(schemata[i], value[i], `[${i}]`, errors);
		}
		return errors;
	}
}

export function map(key_schema: Schema, value_schema: Schema, min_entries: number = 0, max_entries: number = Number.MAX_SAFE_INTEGER): Validator {
	return (value: unknown) => {
		if (!is_object(value)) {
			return DEBUG ? `Map is not an object` : '';
		}
		// Validate keys first, and abort early on unexpected properties.
		for (let key in value) {
			if (validateJSON(key_schema, key) !== true)
				return DEBUG ? `Unexpected property ${key}` : '';
		}
		// Validate the values
		let errors: ErrorMap = {};
		let entries = 0;
		for (let key in value) {
			validate2(value_schema, value[key], `.${key}`, errors);
			entries++;
		}
		if (entries < min_entries)
			errors[''] = DEBUG ? 'Not enough entries in the map' : '';
		if (entries > max_entries)
			errors[''] = DEBUG ? 'Too many entries in the map' : '';
		return errors;
	};
}

// This one short circuits
export function and(...schemata: Schema[]): Validator {
	if (schemata.length < 1) {
		throw new Error('Invalid schema: and needs at least one schema');
	}

	return (value: unknown) => {
		for (let schema of schemata) {
			let res = validateJSON(schema, value);
			if (res !== true) {
				return res;
			}
		}
		return true;
	}
}

// This one executes all the schemata, collecting as many errors as it can
export function and_all(...schemata: Schema[]): Validator {
	if (schemata.length < 1) {
		throw new Error('Invalid schema: and needs at least one schema');
	}

	return (value: unknown) => {
		let errors: ErrorMap = {};
		for (let schema of schemata) {
			let res = validateJSON(schema, value);
			merge_result(errors, '', res);
		}
		return errors;
	}
}

export function or(...schemata: Schema[]): Validator {
	if (schemata.length < 1) {
		throw new Error('Invalid schema: or needs at least one schema');
	}

	return (value: unknown) => {
		for (let schema of schemata) {
			if (validateJSON(schema, value) === true)
				return true;
		}
		return DEBUG ? 'or: value does not match any variant' : '';
	}
}


function check_if_object_is_sane(o: object, is_array = false): void {
	if (Object.getOwnPropertySymbols(o).length > 0)
		throw new Error(`Object has Symbol properties`);
	for (let prop of Object.getOwnPropertyNames(o)) {
		let desc = Object.getOwnPropertyDescriptor(o, prop)!;
		if (desc.get !== undefined || desc.set !== undefined) {
			throw new Error(`Object has getters or setters`);
		}
		if (desc.enumerable !== true && !(is_array && prop === 'length')) {
			throw new Error(`Object has non-enumerable properties`);
		}
		// We do not care about writable or configurable. Frozen schemata or values should work just fine.
	}
}

function check_if_array_is_sane(a: unknown[]): void {
	check_if_object_is_sane(a, true);
}

function object_has_a_property(o: object): boolean {
	for (let prop in o)
		return true;
	return false;
}
