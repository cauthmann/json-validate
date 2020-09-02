
# json-validate

A JSON validator.

# Rationale

We require functionality to verify that some given JSON data (e.g. a parameter to an API call) conforms to a certain schema.
If we verify that all required data is present, of the expected type, and that no additional data is included, then we have already handled most corner cases when dealing with untrusted data.

## Related Work

We could use [JSON Schema](https://json-schema.org/), which is a standardized declarative schema. Validators exist in many programming languages.

Unfortunately it is verbose, and even simple validators are huge. This is not an issue for server-side validation, but gets prohibitive if used on a web client.

## Our approach

For our purposes, all validation happens in javascript, so we can include javascript code to handle complex cases. This keeps the easy cases simple, and the complex cases flexible and manageable.

Arrays and Object schemata are defined by example, which is concise to write and easy to read.

#### Example

```javascript
import {string, integer, and, or} from 'json-validate';

// We're looking for an object with exactly these four properties.
let person_schema = {
	name: string, // Any string will do
	age: and(integer, (age) => age >= 0 && age < 150), // Must be an integer, and in a somewhat plausible range
	hobbies: [string], // An array containing nothing but strings. Empty arrays are fine.
	homepage: or(null, string), // Either null or a string.
	eyes: or('blue', 'brown', 'green', 'other'), // A simple enum.
};
```
See `src/test.mjs` for more examples.

## Comparison

To evaluate our options, we took a somewhat complex example from a production code base (which we can't repeat here) and measured the sizes both of the schema definition, and of the supporting validator code required to validate against the schema.

For json-schema, we used [@cfworker/json-schema](https://github.com/cfworker/cfworker/blob/master/packages/json-schema/README.md) as code that interprets json schemata, and  the popular [ajv](https://ajv.js.org/), which precompiles schemata into pure javascript functions that require no further runtime code.

File sizes (no minification):
```
json-schema: 1210 bytes
our schema:   615 bytes

json-schema, compiled with ajv: 26237 bytes

@cfworker/json-schema: 48314 bytes
our library:            4114 bytes
```

Let's roughly extrapolate these numbers to a full app with `n` different schematas:

Schema code we have to type:
```
json-schema:   1210 * n bytes
our approach:  615 * n bytes
```

Code we have to to deliver to web clients:
```
json-schema, interpreted:   1210 * n + 48314 bytes
json-schema, precompiled:  26237 * n         bytes
our approach:                615 * n +  4114 bytes
```

While we lose on cross-language support, we win on all metrics of code size.

We also win on flexibility. Let's consider an object `{ "min": 2, "max": 5 }`, with the requirement that `max >= min`. We're not aware of any way to enforce that constraint in json-schema, but it's easy for us:
```javascript
and({
	min: number,
	max: number,
}, (o) => o.max >= o.min)
```
Checking the object's shape first allows concise code for the constraint.

# Schema description

## Schemata

A schema can be either of the following:

  * a function which does the validation; we provide a few useful ones. See below for details.
  * a RegExp. This schema definition matches exactly the strings matched by the RegExp. Non-Strings never match.
  * an object by example, where each property is another schema. This will match objects with exactly the same properties (no additional or missing properties), with the schemata applied recursively. See further below how to specify objects with optional properties.
  * an array by example. The first element is a schema which will be applied to all the value's elements. The optional second and third elements are non-negative integers describing the minimum and maximum amount of elements the value may have.
  * a string, number, boolean or null value by example, which matches all values strictly equal to it.

## Functions

A function as a schema will be called with a single parameter: the value to validate. It can return one of four things:
  * `true` if the schema matches the value
  * `false` as a general indicator of failure
  * a `string` as an error message
  * an `object` with error messages, keyed by path relative to the given value (see below for paths and errors). An empty object will be interpreted as success.

Any other return value will cause an exception due to an invalid schema. If the function throws, the exception will be passed through.

## Provided functions and combinators

This package provides a few utility functions, which can be part of a schema definition as explained above.

The following functions match the basic JSON types:

  * `boolean` matches true or false.
  * `number` matches any finite number (not NaN or Infinity).
  * `integer` matches any finite integer.
  * `string` matches strings.
  * `array` matches arrays.
  * `object` matches plain objects. It will not match null, arrays or objects created by custom constructors.

For reusability outside of schema definitions, all of these return a boolean. There is no function to match `null` values - simply use the `null` keyword instead.

The following functions are not valid schemata, but they will return a valid schema when called with the proper parameters:

  * `object(required_properties, optional_properties, min_optional_properties = 0, max_optional_properties = Inf)`: A bit more powerful than the object-by-example notation, this takes two example objects.
  * `tuple(schema1, schema2, ...)`: While the array-by-example schema matches homogenous arrays, this one matches arrays where each element conforms to a different schema. The length of the array and the tuple definition must match.
  * `map(key_schema, value_schema, min_entries, max_entries)`: Matches objects used as maps/dictionaries. One schema is applied to all keys (remember, they're strings!), another is applied to all values.
  * `and(schema1, schema2, ...)`: returns a schema that matches if all the schematas match. It is often useful to combine a type check with a value check.
  * `or(schema1, schema2, ...)`: returns a schema that matches if any of the schemata matches. It is often useful to specify "something or null".

There is no function for enums, because `enum` is a reserved keyword in javascript, and because `or` with values by example works just fine.

Again, see `src/test.mjs` for more examples.

# Validation

`validate(schema, value)` will

  * throw if the Schema is obviously invalid (though not all invalid schemata are guaranteed to throw - see Limitations below)
  * return `true` if the schema matches
  * return an object with error messages, keyed by path, if the schema does not match. For example:

```javascript
validate(person_schema, {
	name: 'Vampire',
	age: 300,
	hobbies: ['blood sucking', 0],
	homepage: null
});
```
returns
```javascript
{
	".age": "", // Too old
	".hobbies[1]": "", // 0 is not a string
}
```

When `process.env.NODE_ENV === 'development'`, the internal error messages are a bit more useful than empty strings. For purposes of form validation, your own validation functions may return user-readable error messages.

## Paths

Every error message has a path pointing to the offending part(s) of the value. Paths are similar to the javascript you would use to access the value.

  * `""` is the value itself.
  * `".property"` for object properties.
  * `"[0]"` to index arrays.

These paths can be concatenated to yield complex paths like `.foo[3].bar[4][5]`.

Note that property names are not sanitized and may contain special characters, including `.[]`. The `object` and `map` schemata will protect against this by assigning errors for unexpected properties to the path of the parent object. Nevertheless, you shouldn't try to parse paths, or rely on them for anything more critical than debugging, logging, or assigning error messages to form elements.

# Maintenance and Stability

This package is meant to scratch my own itches. Changes can and will happen at my own discretion. That being said, feel free to open an issue (or PR) and we can talk.

This package follows [semver](https://semver.org/), which grants no stability before 1.0. I intend to keep all existing schemata working forever, but I will have to use this package on a few projects before committing to that goal.

Things that I will not ever guarantee to be stable:

  * Invalid schemata may become valid in a newer version.
  * The built-in error messages during development may change or disappear completely.
  * The paths where some errors are reported may change.
  * The number of errors reported on a failure may change. We may bail earlier on certain errors, or continue longer on others.
  * Obvious bugs will be fixed, even if that changes existing behaviour.

## Known Limitations

As schemata can contain code, do not use schemata from untrusted sources.

This package is meant to validate values returned by `JSON.parse()`, not any generic javascript value.
Due to functionality like `Object.defineProperty()` and `Symbol`, arbitrary un-enumerable properties may be present in both arrays and objects, including special properties like `toString`, `Symbol.Iterator` or getter methods, which can wreak havok on unsuspecting code. Passing any such objects as a schema or a value is considered undefined behaviour.
During debug builds, there is some code trying to detect such cases, but it is not to be relied upon.
