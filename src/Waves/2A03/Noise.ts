import { NES_Type, FrameCountLength } from "../../APU_Const";

export default class Noise {
	private readonly noiseWaveLengthLookup_NTSC = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
	private readonly noiseWaveLengthLookup_PAL = [4, 8, 14, 30, 60, 88, 118, 148, 188, 236, 354, 472, 708, 944, 1890, 3778];

	private lookUp = this.noiseWaveLengthLookup_NTSC;

	private shiftReg = 1;

	/**通道是否开启 */
	public enabled = true;
	/**计数器 */
	private timer = 0;
	/**计数器最大值 */
	private timerMax = 0;

	/**随机数模式，True为左移1，False为左移6 */
	private randomMode: boolean = false;
	/**是否启用帧计数器 */
	private frameCounterEnable = false;
	/**帧计数器 */
	private frameCounter: number = 0;
	/**输出Bit */
	private outBit: number = 0;
	/**输出音量 */
	volume: number = 0;
	/**输出值 */
	public outputValue: number = 0;

	/**是否使用包络 */
	private envelopeEnabled: boolean = false;
	/**是否允许包络重复 */
	private envelopeLoopingEnable: boolean = false;
	/**包络音量 */
	private envelopeVolumn: number = 0;
	/**包络最大值 */
	private envelopeRateMax: number = 0;
	/**包络计数器 */
	private envelopeRateCount: number = 0;
	/**包络重置 */
	private envelopeReset: boolean = false;

	private temp = 0;

	constructor() {
		this.Reset();
	}

	Reset() {
		this.shiftReg = 1;
		this.outBit = 0;
		this.volume = 0;
		this.outputValue = 0;
		this.frameCounter = 0;
		this.frameCounterEnable = false;
		this.envelopeEnabled = false;
		this.timer = 0;
		this.timerMax = 0;
	}

	/**声波通道是否开启 */
	SetEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (!enabled)
			this.frameCounter = 0;

		this.UpdateSampleValue();
	}

	SetVolumeOrEnvelope(value: number): void {
		this.frameCounterEnable = (value & 0x20) == 0;
		this.envelopeLoopingEnable = (value & 0x10) == 0;
		this.envelopeEnabled = (value & 0x10) == 0;
		this.envelopeRateMax = value & 0xF;	//这里写入Rate，之后执行时钟写入Volume音量
		this.volume = this.envelopeRateMax;
	}

	SetTimerAndMode(value: number): void {
		this.timerMax = this.lookUp[value & 0xF];
		this.randomMode = (value & 8) == 0;
	}

	SetFrameCounter(value: number) {
		this.frameCounter = FrameCountLength[value >> 3];
		this.envelopeReset = true;
	}

	DoClock(cpuClock: number) {
		if (!this.enabled || this.timerMax < 1 || this.frameCounter < 1) {
			this.outputValue = 0;
			return;
		}

		this.timer -= cpuClock;
		while (this.timer <= 0) {
			//同矩形波，但是给出的波长表已经对应的x2了，所以在这里不x2
			this.timer += this.timerMax;
			this.shiftReg <<= 1;
			this.temp = ((this.shiftReg << (this.randomMode ? 1 : 3)) ^ this.shiftReg) & 0x4000;
			if (this.temp != 0) {
				this.shiftReg |= 0x01;
				this.outBit = 0;
			} else {
				this.outBit = 1;
			}
		}
		this.UpdateSampleValue();
	}

	/**执行包络 */
	DoEnvelopDecayClock(): void {
		if (this.envelopeReset) {
			this.envelopeReset = false;
			this.envelopeRateCount = this.envelopeRateMax;
			this.envelopeVolumn = 0xF;
		}

		if (--this.envelopeRateCount <= 0) {
			this.envelopeRateCount += this.envelopeRateMax + 1;
			if (this.envelopeVolumn > 0)
				this.envelopeVolumn--;
			else
				this.envelopeVolumn += this.envelopeLoopingEnable ? 0xF : 0;
		}

		if (this.envelopeEnabled)
			this.volume = this.envelopeVolumn;
		else
			this.volume = this.envelopeRateMax;

		this.UpdateSampleValue();
	}

	DoFrameClock(): void {
		if (this.frameCounterEnable && this.frameCounter > 0) {
			if (--this.frameCounter == 0)
				this.UpdateSampleValue();
		}
	}

	private UpdateSampleValue(): void {
		if (this.enabled && this.frameCounter > 0)
			this.outputValue = this.outBit * this.volume;
		else
			this.outputValue = 0;
	}

	SwitchType(nesType: NES_Type): void {
		switch (nesType) {
			case NES_Type.NTSC:
			case NES_Type.Dendy:
				this.lookUp = this.noiseWaveLengthLookup_NTSC;
				break;
			case NES_Type.PAL:
				this.lookUp = this.noiseWaveLengthLookup_PAL;
				break;
		}
	}
}