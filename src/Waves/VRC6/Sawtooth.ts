class VRC6_Sawtooth {

	apu: APU;

	timer: number = 0;
	timerMax: number = 0;

	volume: number = 0;

	enabled: boolean = false;

	/**输出值 */
	outputValue: number = 0;

	/**锯齿波第几步，总共7步，0-6 */
	stepCount: number = 0;
	/**锯齿波音量升高程度 */
	step: number = 0;
	/**上一次升高记录 */
	lastStep: number = 0;

	constructor(apu: APU) {
		this.apu = apu;
	}

	Reset() {
		this.stepCount = this.step = 0;
		this.timer = this.timerMax = 0;
		this.outputValue = 0;
	}

	SetTimerLow(value: number) {
		this.timerMax = (this.timerMax & 0xF00) | value;
	}

	SetTimerHighAndEnabled(value: number) {
		this.timerMax = (this.timerMax & 0xFF) | ((value & 0xF) << 8);
		this.enabled = (value & 0x80) != 0;
		if (!this.enabled)
			this.outputValue = 0;
	}

	SetStep(value: number) {
		this.step = value & 0x1F;
	}

	DoClock() {
		if (this.enabled && --this.timer <= 0) {
			this.timer += this.timerMax + 1;
			if (this.stepCount == 0) {
				this.lastStep = 0;
			} else {
				this.lastStep = this.lastStep + this.step;
			}
			this.outputValue = Math.floor(this.lastStep / 8) & 0xFF;
			this.stepCount = (this.stepCount + 1) % 7;
		}
	}
}