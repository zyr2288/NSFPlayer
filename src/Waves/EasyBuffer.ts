export class EasyBuffer {

	private lastBuffer = 0;
	private pre = 0;

	Reset() {
		this.lastBuffer = 0;
	}

	SetBuffer(buffer: number): number {
		if (this.pre == 0) {
			this.lastBuffer = buffer;
			this.pre = 1;
			return buffer;
		}

		let temp = Math.abs(buffer) - Math.abs(this.lastBuffer);
		if (temp == 0) {
			this.lastBuffer = buffer;
			return buffer;
		}

		if (this.pre == 1) {
			if (temp > 0) {
				this.pre = -1;
				return -temp;
			} else {
				return temp;
			}
		} else {
			if (temp > 0) {
				this.pre = 1;
				return temp;
			} else {
				return -temp;
			}
		}
	}
}