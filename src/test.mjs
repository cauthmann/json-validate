
import { and, and_all, or, boolean, number, integer, string, array, object, map, tuple, partial_object } from './validate.mjs';
import { match, fail, throws, finish_tests } from './testharness.mjs';

// Functions as validators
match(() => true, 123);
fail(() => 'Error', 123.4, ['']);
fail([(v) => v % 2 > 0], [1, 2, 3, 4], ['[1]', '[3]']);
fail([(arr) => {
	let errors = {};
	for (let i = 0; i < arr.length; i++) {
		if (arr[i] % 2 === 0)
			errors[`[${i}]`] = 'Number is not odd';
	}
	return errors;
}], [[1, 2], [3, 4]], ['[0][1]', '[1][1]']);
match(() => {
	return {}; // An object with no errors means that the value matches.
}, 1);

// Primitive values
match(null, null);
fail(null, 'null');
fail(null, undefined);
fail(null, 0);
match('1', '1')
fail('1', 1);
fail('1', '1.0');
match(1, 1.0);
fail(1, '1');
match(true, true);
fail(true, false);

// Booleans
match(boolean, false);
match(boolean, true);
fail(boolean, 1);

// Numbers
match(integer, 123);
fail(integer, 123.4);
match(number, 123);
match(number, 123.4);
fail(number, 0 / 0); // NaN
fail(number, 1 / 0); // Infinity

// Strings
match(string, 'Hello World');
match(string, '');
fail(string, 123);
match(/world/, 'hello world!');
fail(/^world$/, 'hello world!');
match(/^world$/, 'world');
fail(/world/, 'void');
fail(/1/, 1);

// Arrays
match(array, []);
match(array, [1, 2, 3]);
fail(array, {});
fail(array, Array);
match(
	[string],
	['a', 'b', 'c']
);
fail(
	[string],
	['a', 2, 'c'],
	['[1]']
);
fail(
	[string],
	[1, 'b', 'c', 4]
	['[0]', '[3]']
);
match(
	[() => false], // The elements' schema always fails, but the array has no elements, so it's never called.
	[]);
match(
	[[string]],
	[['a'], ['b', 'c']]
);
// Arrays with a minimum and maximum length
{
	let schema = [integer, 1, 2];
	fail(schema, []);
	match(schema, [1]);
	match(schema, [1, 2]);
	fail(schema, [1, 2, 3]);
}
{
	// just a minimum length
	let schema = [integer, 1];
	fail(schema, []);
	match(schema, [1]);
	match(schema, [1, 2]);
	match(schema, [1, 2, 3]);
}

// Arrays as tuples
{
	let schema = tuple(number, string, true);
	match(schema, [1, '2', true]);
	fail(schema, ['1', 2, false], ['[0]', '[1]', '[2]']);
	fail(schema, [], ['']);
	fail(schema, [1, 2, 3, 4], ['']);
}

// Objects
match({}, {});
{
	let schema = {
		a: string,
		b: number
	};
	match(schema, {
		a: '',
		b: 1
	});
	fail(schema, {
		a: '',
		b: 'not-a-number'
	}, ['.b']);
	fail(schema, {
		a: 'b is missing'
	}, ['.b']);
	fail(schema, {
		a: '',
		b: 1,
		"a[39]": 'unexpected property'
	}, ['']); // This fails on '', not '.a[39]' to keep paths in error object sane.
}
{
	let schema = {
		a: {
			b: {
				c: [number]
			}
		}
	};
	match(schema, {
		a: {
			b: {
				c: [1, 2, 3]
			}
		}
	});
	fail(schema, {
		a: {
			b: {
				c: [1, '2', 3]
			}
		}
	}, ['.a.b.c[1]']);
}
{
	let schema = {
		foo: [integer],
		bar: string
	};
	fail(schema, {
		foo: [1.1, 2, '3'],
		bar: 1
	}, ['.foo[0]', '.foo[2]', '.bar']);
}
// Objects with optional properties
{
	let schema = object({
		required: string
	}, {
		optional1: string,
		optional2: string
	});
	match(schema, {
		required: ''
	});
	match(schema, {
		required: '',
		optional2: ''
	});
	match(schema, {
		required: '',
		optional1: '',
		optional2: ''
	});
	fail(schema, {
		required: '',
		unexpected: ''
	}, ['']);
	fail(schema, {
		optional1: '',
		optional2: ''
	}, ['.required']);
	fail(schema, {
		unexpected: ''
	}, ['']); // Currently, this will abort on an unexpected property, thus it won't emit an error at '.required' for the missing property.
	fail(schema, {
		required: 1,
		optional1: 1,
		optional2: 1
	}, ['.required', '.optional1', '.optional2']);
}
{
	// This schema only accepts objects with 1-2 of the optional properties
	let schema = object({
	}, {
		optional1: string,
		optional2: string,
		optional3: string
	}, 1, 2);
	match(schema, {
		optional1: '',
	});
	match(schema, {
		optional1: '',
		optional3: '',
	});
	fail(schema, {}, ['']);
	fail(schema, {
		optional1: '',
		optional2: '',
		optional3: ''
	}, ['']);
	// failing properties are counted. This object still has too many properties.
	fail(schema, {
		optional1: '',
		optional2: 1,
		optional3: ''
	}, ['', '.optional2']);
}
// Partial objects
{
	let schema = partial_object({
		foo: 1
	});
	match(schema, {
		foo: 1
	});
	match(schema, {
		foo: 1,
		bar: 2
	});
	fail(schema, {
		foo: 2,
		bar: 2
	});
	fail(schema, {
		bar: 2
	});
	fail(schema, {});
	fail(schema, 1);
}

// Objects as maps
{
	let schema = map(/[0-9]+/, integer, 1, 2);
	match(schema, { 1: 1, 2: 2 });
	match(schema, { 1: 1 });
	fail(schema, { 1: "" }, ['.1']);
	fail(schema, {}, ['']);
	fail(schema, { 1: 1, 2: 2, 3: 3 }, ['']);
	fail(schema, { a: 1, 2: 2 }, ['']);
	fail(schema, { a: "", 2: 2 }, ['']);
	fail(schema, { a: "", b: "", 2: 2 }, ['']);
}
{
	let schema = map(/[a-z]+/, [integer]);
	match(schema, { a: [1, 2, 3] });
	fail(schema, { a: [1, "2", "3"], 9: [""] }, ['']); // Early abort on unexpected properties
	fail(schema, { 9: [""], a: [1, "2", "3"] }, ['']);
}

// Combinators
{
	let schema = or((v) => v === 13, (v) => v === 15, (v) => v === 18);
	match(schema, 13);
	fail(schema, 14);
	match(schema, 15);
	fail(schema, 16);
	match(schema, 18);
	fail(schema, true);
}
{
	let schema = or(integer, null);
	match(schema, 1);
	match(schema, null);
	fail(schema, 'neither');
}
{
	let schema = and((v) => v > 0, (v) => v < 10, (v) => v % 2 === 0);
	match(schema, 4);
	fail(schema, 5);
}
{
	let schema = and(string, (s) => s === s.trim());
	match(schema, 'trimmed');
	fail(schema, ' non-trimmed ');
}
{
	let schema = and({
		min: number,
		max: number,
	}, (o) => o.max >= o.min);
	match(schema, {
		min: 3,
		max: 4
	});
	fail(schema, {
		min: 4,
		max: 3
	});
}
{
	let schema = and_all(number, 3);
	match(schema, 3);
	fail(schema, 2);
}

// Enums
{
	let schema = or(1, 's', true);
	match(schema, 1);
	fail(schema, '1');
	match(schema, 's');
	fail(schema, 'S');
	match(schema, true);
	fail(schema, false);
}

// Complex example
{
	let trimmedString = and(string, (s) => s === s.trim());
	let age = and(integer, (age) => age >= 0 && age < 150);
	let userid = /^[a-z]+/;
	let person = {
		userid: userid,
		name: trimmedString,
		age: or(null, age),
		hobbies: [trimmedString]
	};
	match(person, {
		userid: 'christian',
		name: 'Christian Authmann',
		age: null,
		hobbies: ['programming']
	});
	fail(person, {
		userid: 1, // Fails: not a string
		name: ' ', // Fails: not trimmed
		age: 200, // Fails: too old
		hobbies: ['vampirism']
	}, ['.userid', '.name', '.age']);

	let group = {
		supervisor: or(null, person),
		members: [person]
	};
	match(group, {
		supervisor: null,
		members: []
	});
}

// Test whether invalid schemata throw
{
	let schema = {};
	match(schema, {});
	Object.defineProperty(schema, 'foo', { get: () => true });
	throws(schema, {});
}
{
	let schema = {};
	match(schema, {});
	schema[Symbol()] = true;
	throws(schema, {});
}
{
	let schema = ['string'];
	match(schema, []);
	schema[2] = 0;
	throws(schema, []);
}
{
	let schema = ['string'];
	match(schema, []);
	schema.foo = '';
	throws(schema, []);
}
{
	let schema = ['string'];
	match(schema, []);
	schema[Symbol()] = '';
	throws(schema, []);
}
{
	let schema = Symbol();
	throws(schema, null);
}

// Report errors and successes, then exit.
finish_tests();
