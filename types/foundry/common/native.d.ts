declare global {
	interface NumberConstructor {
		/**
		 * Test whether a value is numeric.
		 * This is the highest performing algorithm currently available, per https://jsperf.com/isnan-vs-typeof/5
		 * @memberof Number
		 * @param {*} n       A value to test
		 * @return {boolean}  Is it a number?
		 */
		isNumeric(v: unknown): boolean;
	}
}

export {};
