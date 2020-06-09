export default class VRC6_Square {

	/**Duty查询表 */
	private readonly dutyLookup = [
		[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	];

	/**占空比类型 */
	private dutyType: number = 0;
	/**占空比的Index */
	private count: number = 0;

	/**声波计时器，若小于8，则静音 */
	private timerMax: number = 0;
	/**当前声波计时器 */
	private timer: number = 0;
	/**输出音量 */
	private volume: number = 0;

	/**是否允许 */
	private enabled: boolean = false;
	/**总时钟数 */
	private cycleCounter: number = 0;

	/**输出的声音值 */
	outputValue: number = 0;

	/**
	 * 构造函数
	 */
	constructor() {
		this.Reset();
	}

	Reset() {
		this.dutyType = 0;
		this.count = 0;
		this.timer = 0;
		this.volume = 0;
		this.enabled = false;
		this.cycleCounter = 0;
		this.outputValue = 0;
	}

	/**声波通道是否开启 */
	SetEnabled(enabled: boolean) {
		this.enabled = enabled;
		if (!enabled)
			this.outputValue = 0;
	}

	/**设定Duty类型、音量或包络Flag以及其值，相当于0x4000 */
	SetDutyAndVolume(value: number) {
		this.dutyType = (value >> 4) & 7;
		if ((value & 0x80) != 0)
			this.dutyType = 8;

		this.volume = value & 0xF;
	}

	/**设定频率低位，相当于0x4002 */
	SetTimerLow(value: number) {
		this.timerMax = (this.timerMax & 0xF00) | value;
	}

	/**设定频率高位，相当于0x4003 */
	SetTimerHighAndEnabled(value: number) {
		this.timerMax = (this.timerMax & 0xFF) | ((value & 0xF) << 8);
		this.enabled = (value & 0x80) != 0;
		if (!this.enabled)
			this.volume = 0;
	}

	DoClock(cpuClock: number) {
		if (!this.enabled || this.timerMax < 1) {
			this.outputValue = 0;
			return;
		}

		this.timer -= cpuClock;
		while (this.timer <= 0) {
			this.timer += this.timerMax + 1;
			this.count++;
			this.count &= 0x1F;
		}
		this.outputValue = this.volume * this.dutyLookup[this.dutyType][this.count & 0xF];

	}
}