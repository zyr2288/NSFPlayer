class APU {

	nsf: NSF;

	/**
	 * 多少个CPU频率采样一次，800 = 48000 / 60
	 * 因为WebAudio默认采样频率为48000，即一秒钟采样48000次
	 * 一秒为60帧
	 */
	public SAMPLE_CPU_CLOCKS: number;
	/**采样计数器 */
	public sampleTime = 0;

	/**锯齿波输出表 */
	public squareTable: number[] = [];
	/**三角波、噪声波、DPCM输出表 */
	public tndTable: number[] = [];

	/**
	 * APU执行时钟，两个CPU时钟执行一个APU时钟
	 * http://wiki.nesdev.com/w/index.php/APU_Frame_Counter
	 */
	private readonly APU_COUNT_STEP = [
		3728.5, 7456.5, 11185.5, 14914.5, 18640.5
	];

	/**
	 * APU可以自选模式，并非要根据制式改变，False为NTSC制式，True为PAL制式
	 * Flase为4-step，True为5-step
	 */
	private sequencerMode: boolean = false;
	/**Step计数器 */
	private sequencerStepCount: number = 0;
	/**最大Step */
	private sequencerStepMax: number = 4;

	// 矩形波
	square1 = new Square(this, 1);
	square2 = new Square(this, 0);

	triangle = new Triangle(this);

	noise = new Noise(this);

	dmc = new DMC(this);

	vrc6_square1 = new VRC6_Square(this);
	vrc6_square2 = new VRC6_Square(this);

	vrc6_sawtooth = new VRC6_Sawtooth(this);

	/**APU计时器 */
	private apuClock = 0;

	private pulseOut = 0;
	private tndOut = 0;
	private vrc6Out = 0;

	/**帧计时器各值长度00-1F */
	public frameCountLength = [
		0x0A, 0xFE, 0x14, 0x02, 0x28, 0x04, 0x50, 0x06,
		0xA0, 0x08, 0x3C, 0x0A, 0x0E, 0x0C, 0x1A, 0x0E,
		0x0C, 0x10, 0x18, 0x12, 0x30, 0x14, 0x60, 0x16,
		0xC0, 0x18, 0x48, 0x1A, 0x10, 0x1C, 0x20, 0x1E
	];

	constructor(nsf: NSF) {
		this.nsf = nsf;

		this.SAMPLE_CPU_CLOCKS = Const.CPU_NTSC / (this.nsf.audioContext.sampleRate / 60);

		// http://wiki.nesdev.com/w/index.php/APU_Mixer
		// APU混合输出表，在这里初始化表格内容
		for (let index = 0; index < 31; index++) {
			this.squareTable[index] = 95.52 / (8128.0 / index + 100);
		}

		// http://wiki.nesdev.com/w/index.php/APU_Mixer
		// APU混合输出表，在这里初始化表格内容
		for (let index = 0; index < 203; index++) {
			this.tndTable[index] = 163.67 / (24329.0 / index + 100);
		}
	}

	Reset() {
		this.sampleTime = 0;
		this.apuClock = 0;
		this.sequencerStepCount = 0
		this.sequencerStepMax = 4;

		this.square1.Reset();
		this.square2.Reset();
		this.triangle.Reset();
		this.noise.Reset();
		this.dmc.Reset();

		this.vrc6_square1.Reset();
		this.vrc6_square2.Reset();
	}

	/**
	 * 执行一个帧时钟
	 * http://wiki.nesdev.com/w/index.php/APU_Frame_Counter
	 */
	DoFrame() {
		if (this.apuClock <= this.APU_COUNT_STEP[this.sequencerStepCount])
			return;

		if (this.sequencerStepCount++ >= this.sequencerStepMax) {
			this.sequencerStepCount = 0;
			this.apuClock = 0;
		}

		if (this.sequencerStepCount == 1 || this.sequencerStepCount == 3) {
			this.square1.DoFrameClock();
			this.square2.DoFrameClock();

			this.square1.DoSweepClock();
			this.square2.DoSweepClock();

			this.triangle.DoFrameClock();

			this.noise.DoFrameClock();
		}

		if (this.sequencerStepCount < 3 || this.sequencerStepCount == 4) {
			this.square1.DoEnvelopDecayClock();
			this.square2.DoEnvelopDecayClock();

			this.triangle.DoLinerClock();

			this.noise.DoEnvelopDecayClock();
		}
	}

	/**执行一个CPU时钟 */
	DoClock() {
		this.square1.DoClock();
		this.square2.DoClock();

		this.triangle.DoClock();

		this.noise.DoClock();

		this.dmc.DoClock();

		if (this.nsf.nsfFile.chip_VRC6) {
			this.vrc6_square1.DoClock();
			this.vrc6_square2.DoClock();
			this.vrc6_sawtooth.DoClock();
		}

		this.apuClock++;
	}

	SetRegister(address: number, value: number) {
		switch (address) {
			case 0x4000:
				this.square1.SetDutyAndVolume(value);
				break;
			case 0x4001:
				this.square1.SetSweep(value);
				break;
			case 0x4002:
				this.square1.SetTimerLow(value);
				break;
			case 0x4003:
				this.square1.SetTimerHigh(value);
				break;
			case 0x4004:
				this.square2.SetDutyAndVolume(value);
				break;
			case 0x4005:
				this.square2.SetSweep(value);
				break;
			case 0x4006:
				this.square2.SetTimerLow(value);
				break;
			case 0x4007:
				this.square2.SetTimerHigh(value);
				break;
			case 0x4008:
				this.triangle.SetLinearCounter(value);
				break;
			case 0x4009:
				break;
			case 0x400A:
				this.triangle.SetTimerLow(value);
				break;
			case 0x400B:
				this.triangle.SetTimerHigh(value);
				break;
			case 0x400C:
				this.noise.SetVolumeOrEnvelope(value);
				break;
			case 0x400E:
				this.noise.SetTimerAndMode(value);
				break;
			case 0x400F:
				this.noise.SetFrameCounter(value);
				break;
			case 0x4010:
				this.dmc.SetFlagsAndRate(value);
				break;
			case 0x4011:
				this.dmc.SetDirectLoad(value);
				break;
			case 0x4012:
				this.dmc.SetSampleAddress(value);
				break;
			case 0x4013:
				this.dmc.SetSampleLength(value);
				break;
			case 0x4015:
				this.square1.SetEnabled((value & 1) != 0);
				this.square2.SetEnabled((value & 2) != 0);
				this.triangle.SetEnabled((value & 4) != 0);
				this.noise.SetEnabled((value & 8) != 0);
				this.dmc.SetEnabled((value & 0x10) != 0);
				break;
			case 0x4017:
				this.sequencerMode = (value & 0x80) != 0;
				this.sequencerStepMax = this.sequencerMode ? 4 : 3;
				this.sequencerStepCount = this.sequencerMode ? 0 : 4;
				break;
		}
	}

	/**设置扩展音源 */
	SetExpansionAudio(address: number, value: number) {
		if (this.nsf.nsfFile.chip_VRC6) {
			switch (address) {

				case 0x9000:
					this.vrc6_square1.SetDutyAndVolume(value);
					break;
				case 0x9001:
					this.vrc6_square1.SetTimerLow(value);
					break;
				case 0x9002:
					this.vrc6_square1.SetTimerHighAndEnabled(value);
					break;

				case 0xA000:
					this.vrc6_square2.SetDutyAndVolume(value);
					break;
				case 0xA001:
					this.vrc6_square2.SetTimerLow(value);
					break;
				case 0xA002:
					this.vrc6_square2.SetTimerHighAndEnabled(value);
					break;

				case 0xB000:
					this.vrc6_sawtooth.SetStep(value);
					break;
				case 0xB001:
					this.vrc6_sawtooth.SetTimerLow(value);
					break;
				case 0xB002:
					this.vrc6_sawtooth.SetTimerHighAndEnabled(value);
					break;
			}
		}
	}

	/**获取样品值 */
	Sample(): number {

		//主要根据 http://wiki.nesdev.com/w/index.php/APU_Mixer
		this.pulseOut = 0.00752 * (this.square1.outputValue + this.square2.outputValue);
		this.tndOut = 0.00851 * this.triangle.outputValue + 0.00494 * this.noise.outputValue + 0.00335 * this.dmc.outputValue;
		//this.pulseOut = this.squareTable[this.square1.outputValue + this.square2.outputValue];
		//this.tndOut = this.tndTable[3 * this.triangle.outputValue + 2 * this.noise.outputValue + this.dmc.outputValue];

		let result = this.pulseOut + this.tndOut;

		if (this.nsf.nsfFile.chip_VRC6) {
			result += 0.00752 * (this.vrc6_square1.outputValue + this.vrc6_square2.outputValue);
			result += 0.00752 * this.vrc6_sawtooth.outputValue;
		}

		return result;
	}
}