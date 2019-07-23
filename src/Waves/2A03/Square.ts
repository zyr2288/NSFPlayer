/**
 * 矩形波
 * 两个CPU Clock 执行一个 Tick
 * 所以这里的Timer为 * 2
 */
class Square {

	apu: APU;

	/**Duty查询表 */
	dutyLookup = [
		[0, 1, 0, 0, 0, 0, 0, 0],
		[0, 1, 1, 0, 0, 0, 0, 0],
		[0, 1, 1, 1, 1, 0, 0, 0],
		[1, 0, 0, 1, 1, 1, 1, 1]
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

	/**是否允许sweep */
	private sweepEnabled: boolean = false;
	/**True为Decrease降频，False为Increase升频 */
	private sweepDirection: boolean = false;
	/**Sweep更新频率 */
	private sweepUpdateRate: number = 0;
	/**Sweep更新频率的计数器 */
	private sweepUpdateCount: number = 0;
	/**Sweep右移量 */
	private sweepRightShiftAmount: number = 0;
	/**如果是Square1通道，则在Sweep降频的时候多减去这个数 */
	private sweepChange: number = 0;

	/**包络是否允许，True为允许，False为固定音量 */
	private envelopeEnabled: boolean = false;
	/**True(长度计数器时钟禁用)为启用循环，False(包络衰减循环启用)禁用循环 */
	private envelopeLoopingEnable: boolean = false;
	/**包络衰减频率（声音衰减频率？） */
	private envelopeRateMax: number = 0;
	/**包络衰减计数器 */
	private envelopeRateCount: number = 0;
	/**包络重置，写关于 4003/4007/400F 会重置包络 */
	private envelopeReset: boolean = false;
	/**包络音量 */
	private envelopeVolumn: number = 0;

	/**帧计时器 */
	private frameCounter: number = 0;
	/**是否允许帧计时器 */
	private frameCounterEnable: boolean = false;

	/**是否允许 */
	public enabled: boolean = false;

	/**输出的声音值 */
	public outputValue: number = 0;

	/**
	 * 构造函数
	 * @param apu APU
	 * @param sweepChange 如果是Square1通道，则在Sweep降频的时候多减去这个数
	 */
	constructor(apu: APU, sweepChange: number) {
		this.apu = apu;
		this.sweepChange = sweepChange;
		this.Reset();
	}

	Reset() {
		this.dutyType = 0;
		this.count = 0;
		this.timer = 0;
		this.volume = 0;
		this.envelopeEnabled = false;
		this.envelopeLoopingEnable = false;
		this.enabled = true;
		this.outputValue = 0;
	}

	/**声波通道是否开启 */
	SetEnabled(enabled: boolean) {
		this.enabled = enabled;
		if (!enabled)
			this.frameCounter = 0;

		this.UpdateSampleValue();
	}

	/**设定Duty类型、音量或包络Flag以及其值，相当于0x4000 */
	SetDutyAndVolume(value: number) {
		this.dutyType = (value & 0xC0) >> 6;
		this.frameCounterEnable = (value & 0x20) == 0;
		this.envelopeLoopingEnable = (value & 0x10) == 0;
		this.envelopeEnabled = (value & 0x10) == 0;
		this.envelopeRateMax = value & 0xF;	//这里写入Rate，之后执行时钟写入Volume音量
	}

	/**设定Sweep，相当于 0x4001 */
	SetSweep(value: number) {
		this.sweepEnabled = (value & 0x80) != 0;
		this.sweepUpdateRate = (value >> 4) & 7;
		this.sweepDirection = (value & 8) != 0;
		this.sweepRightShiftAmount = value & 7;
	}

	/**设定频率低位，相当于0x4002 */
	SetTimerLow(value: number) {
		this.timerMax = (this.timerMax & 0x700) | (value & 0xFF);
	}

	/**设定频率高位，相当于0x4003 */
	SetTimerHigh(value: number) {
		this.envelopeReset = true;
		this.timerMax = (this.timerMax & 0xFF) | ((value & 0x7) << 8);
		if (this.enabled)
			this.frameCounter = this.apu.frameCountLength[value >> 3];
	}

	/**执行一个APU时钟 */
	UpdateSampleValue() {
		if (this.enabled && this.frameCounter > 0 && this.timerMax > 7) {
			if (!this.sweepDirection && this.timer + (this.timer >> this.sweepRightShiftAmount) > 4095)
				this.outputValue = 0;
			else
				this.outputValue = this.volume * this.dutyLookup[this.dutyType][this.count];
		} else {
			this.outputValue = 0;
		}
	}

	/**
	 * 执行APU时钟
	 */
	DoClock() {
		if (--this.timer <= 0) {
			this.count = (this.count + 1) & 0x7;
			this.timer += this.timerMax + 1;
			this.UpdateSampleValue();
		}
	}

	/**执行一次FrameCount */
	DoFrameClock() {
		if (this.frameCounterEnable && this.frameCounter > 0) {
			if (--this.frameCounter == 0) {
				this.UpdateSampleValue();
			}
		}
	}

	/**执行包络 */
	DoEnvelopDecayClock() {
		if (this.envelopeReset) {
			this.envelopeReset = false;
			this.envelopeRateCount = this.envelopeRateMax + 1;
			this.envelopeVolumn = 0xF;
		} else if (--this.envelopeRateCount <= 0) {
			this.envelopeRateCount = this.envelopeRateMax + 1;
			if (this.envelopeVolumn > 0)
				this.envelopeVolumn--;
			else
				this.envelopeVolumn = this.envelopeLoopingEnable ? 0xF : 0;
		}

		if (this.envelopeEnabled)
			this.volume = this.envelopeVolumn;
		else
			this.volume = this.envelopeRateMax;

		this.UpdateSampleValue();
	}

	/**执行一次Seep */
	DoSweepClock() {
		if (--this.sweepUpdateCount <= 0) {
			this.sweepUpdateCount = this.sweepUpdateRate + 1;
			if (this.sweepEnabled && this.sweepRightShiftAmount > 0 && this.timer > 7) {
				if (!this.sweepDirection) {
					this.timerMax += this.timerMax >> this.sweepRightShiftAmount;
					if (this.timerMax > 4095)
						this.timerMax = 4095;

				} else {
					this.timerMax = this.timerMax - (this.timerMax >> this.sweepRightShiftAmount) - this.sweepChange;
				}
			}
		}
	}
}