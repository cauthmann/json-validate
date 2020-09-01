
import validateJSON from './validate.mjs';

// Unless you'd like to download 300+ packages for jest, we'll just include a simple testing harness

function arrays_equal(a, b) {
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i])
			return false;
	}
	return true;
}

let tests = 0;
let errors = 0;
function error(schema, value, expected, result) {
	errors++;
	console.error('Test failed', schema, value, expected, result);
}

export function match(schema, value) {
	tests++;
	let res = validateJSON(schema, value);
	if (res !== true) {
		error(schema, value, true, res);
	}
}

export function fail(schema, value, expected = false) {
	tests++;
	let res = validateJSON(schema, value);

	if (expected === false) {
		if (res === true)
			error(schema, value, expected, res);
		return;
	}
	// We care about failures in exactly the expected paths
	// Note: Object.keys(true) === []
	if (!arrays_equal(expected.sort(), Object.keys(res).sort()))
		error(schema, value, expected, res);
}

export function throws(schema, value) {
	tests++;
	try {
		let res = validateJSON(schema, value)
		error(schema, value, 'throws', res);
	}
	catch (e) {
		// throws as expected
	}
}

export function finish_tests() {
	// Report results
	if (errors > 0) {
		console.error(errors, 'of', tests, 'tests failed');
		process.exit(5);
	}

	console.log('All', tests, 'tests succeeded!');
	process.exit(0);
}
