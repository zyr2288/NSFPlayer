/**三角波 */
class Triangle {

	apu: APU;

	/**频道是否允许 */
	enabled = false;
	/**当前频率的计数器 */
	private timer = 0;
	/**最大频率的计数器 */
	private timerMax = 0;
	/**帧计数器 */
	private frameCounter = 0;

	/**每一步 */
	private steps = [
		0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xA, 0xB, 0xC, 0xD, 0xE, 0xF,
		0xF, 0xE, 0xD, 0xC, 0xB, 0xA, 0x9, 0x8, 0x7, 0x6, 0x5, 0x4, 0x3, 0x2, 0x1, 0x0
	];

	/**所运行到的步 */
	private stepIndex = 0;

	/**
	 * 长度计数器是否设置
	 * 如果长度计数器为True，则FrameCounter的使用为False
	 */
	private linerCounterFlag: boolean = false;
	/**线性计数器重载标记 */
	private linerCounterReloadFlag: boolean = false;
	/**长度计数器 */
	private linerCounter: number = 0;
	/**长度计数器最大值 */
	private linerCounterMax: number = 0;

	/**输出值 */
	public outputValue: number = 0;

	constructor(apu: APU) {
		this.apu = apu;
		this.Reset();
	}

	/**重置 */
	Reset() {
		this.timer = 0;
		this.timerMax = 0;
		this.frameCounter = 0;
		this.stepIndex = 0;
		this.linerCounterFlag = false;
		this.linerCounter = 0;
		this.enabled = true;
	}

	SetEnabled(value: boolean) {
		this.enabled = value;
		if (!value) {
			this.outputValue = 0;
		}
	}

	SetTimerLow(value: number) {
		this.timerMax = (this.timerMax & 0x700) | (value & 0xFF);
	}

	SetTimerHigh(value: number) {
		this.linerCounterReloadFlag = true;
		this.timerMax = (this.timerMax & 0xFF) | ((value & 0x7) << 8);
		if (this.enabled)
			this.frameCounter = this.apu.frameCountLength[value >> 3];
	}

	SetLinearCounter(value: number) {
		this.linerCounterFlag = (value & 0x80) == 0;
		this.linerCounterMax = value & 0x7F;
		this.linerCounterReloadFlag = true;
	}

	//执行一个CPU时钟
	DoClock() {
		if (this.timerMax == 0) {
			this.outputValue = 0;
			this.stepIndex = 0;
			return;
		}

		this.timer -= 2;
		if (this.timer <= 0) {
			this.timer += this.timerMax + 1;
			if (this.linerCounter > 0 && this.frameCounter > 0) {
				this.stepIndex = (this.stepIndex + 1) & 0x1F;
				if (this.enabled) {
					this.outputValue = this.steps[this.stepIndex];
				}
			}
		}
	}

	DoFrameClock() {
		if (!this.linerCounterFlag && this.frameCounter > 0) {
			this.frameCounter--;
		}
	}

	DoLinerClock() {
		if (this.linerCounterReloadFlag) {
			this.linerCounter = this.linerCounterMax;
			this.linerCounterReloadFlag = false;
		}

		if (this.linerCounterFlag && this.linerCounter > 0) {
			this.linerCounter--;
		}
	}
}