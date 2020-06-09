import NSF from "../../NSF";

export default class DPCM {

	private nsf: NSF;

	enabled: boolean = false;

	/**采样时钟间隔，以CPU时钟为准，NTSC */
	private readonly rateIndex_NTSC = [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54];
	/**采样时钟间隔，以CPU时钟为准，PAL */
	private readonly rateIndex_PAL = [398, 354, 316, 298, 276, 236, 210, 198, 176, 148, 132, 118, 98, 78, 66, 50];

	IRQEnables: boolean = false;

	/**样本是否重复 */
	private loopFlag: boolean = false;
	/**样本地址 */
	private sampleAddress: number = 0;
	/**正在采样的地址 */
	private nowAddress: number = 0;
	/**样本长度 */
	private sampleLength: number = 0;
	/**现在播放的地址 */
	private nowLength: number = 0;

	/**计数器 */
	private timer: number = 0;
	/**计数器最大值 */
	private timerMax: number = 0;
	/**中心计数器 */
	private deltaCounter: number = 0;
	/**最低位偏移 */
	private dacLsb: number = 0;
	/**读取数据的偏移 */
	private dataCount: number = 0;
	/**所要读取的数据 */
	private data: number = 0;

	/**输出值 */
	outputValue: number = 0;

	constructor(nsf: NSF) {
		this.nsf = nsf;
		this.Reset();
	}

	Reset() {
		this.data = 0;
		this.dataCount = 8;
		this.deltaCounter = 0;
		this.IRQEnables = false;
		this.loopFlag = false;
		this.timer = this.timerMax = 0;
	}

	SetEnabled(value: boolean) {
		this.enabled = value;
		if (!value) {
			this.outputValue = 0;
		} else {
			this.dataCount = 1;
			this.GetSample();
		}
	}

	SetFlagsAndRate(value: number) {
		this.IRQEnables = (value & 0x80) != 0;
		this.loopFlag = (value & 0x40) != 0;
		this.timerMax = this.rateIndex_NTSC[value & 0xF];
	}

	SetDirectLoad(value: number) {
		this.deltaCounter = ((value >> 1) & 0x3F);
		this.dacLsb = value & 1;
		this.outputValue = value & 0x7F;
	}

	SetSampleAddress(value: number) {
		this.sampleAddress = (value << 6) + 0xC000;
		this.nowAddress = this.sampleAddress;
	}

	SetSampleLength(value: number) {
		this.sampleLength = (value << 4) + 1;
		this.nowLength = this.sampleLength;
	}

	DoClock(cpuClock: number) {
		if (!this.enabled || this.timerMax < 1) {
			this.outputValue = 0;
			return;
		}

		this.timer -= cpuClock;
		while (this.timer <= 0) {
			this.timer += this.timerMax;
			this.deltaCounter += (this.data & 1) == 0 ? -1 : 1;

			if (this.deltaCounter < 0)
				this.deltaCounter = 0;
			else if (this.deltaCounter > 0x3F)
				this.deltaCounter = 0x3F;

			this.data >>= 1;
			this.GetSample();
		}
		this.outputValue = (this.deltaCounter << 1) + this.dacLsb;
	}

	GetSample() {
		if (--this.dataCount <= 0) {
			this.dataCount = 8;
			if (this.nowLength == 0 && this.loopFlag) {
				this.nowAddress = this.sampleAddress;
				this.nowLength = this.sampleLength;
			} else if (this.nowLength > 0) {

				this.data = this.nsf.nsfFile.ReadFileData(this.nowAddress, 1);
				this.nsf.cpu.AddClock(2);

				this.nowLength--;
				if (++this.nowAddress > 0xFFFF)
					this.nowAddress = 0x8000;
			}
		}
	}
}