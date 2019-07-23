class Utils {
	/**移除0字节 */
	static RemoveZeroByte(source: Uint8Array): Uint8Array {
		let start = 0;
		for (let index = source.length - 1; index >= 0; index--) {
			if (source[index] == 0)
				continue;

			start = index;
			break;
		}
		return source.slice(0, start + 1);
	}
}