export default class VRC6_Sawtooth {

	private enabled: boolean = false;
	private timer: number = 0;
	private timerMax: number = 0;

	/**输出值 */
	outputValue: number = 0;

	/**锯齿波第几步，总共7步，0-6 */
	private stepCount: number = 0;
	/**锯齿波音量升高程度 */
	private step: number = 0;
	/**上一次升高记录 */
	private lastStep: number = 0;

	constructor() {
		this.Reset();
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
		if (!this.enabled) {
			this.outputValue = 0;
			this.step = 0;
			this.stepCount = 0;
		}
	}

	SetStep(value: number) {
		this.step = value & 0x3F;
	}

	DoClock(cpuClock: number) {
		if (!this.enabled || this.timerMax < 1) {
			this.outputValue = 0;
			return;
		}

		this.timer -= cpuClock;
		while (this.timer <= 0) {
			this.timer += (this.timerMax + 1) << 1;
			if (this.stepCount == 0) {
				this.lastStep = 0;
			} else {
				this.lastStep = this.lastStep + this.step;
			}
			this.stepCount++
			this.stepCount %= 7;
		}
		this.outputValue = this.lastStep >> 3;
	}
}