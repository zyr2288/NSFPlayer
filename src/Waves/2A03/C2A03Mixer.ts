import IChipMixer from "../IChipMixer";
import NSF from "../../NSF";
import Square from "./Square";
import Triangle from "./Triangle";
import Noise from "./Noise";
import DPCM from "./DPCM";


export default class C2A03Mixer implements IChipMixer {

	private square1: Square;
	private square2: Square;
	private triangle: Triangle;
	private noise: Noise;
	private dpcm: DPCM;

	private square_table: number[];
	private tnd_table: number[];

	private dcValue: number;

	constructor(nsf: NSF) {
		this.square1 = new Square(1);
		this.square2 = new Square(0);
		this.triangle = new Triangle();
		this.noise = new Noise();
		this.dpcm = new DPCM(nsf);

		let max_sqr = 0;
		let max_tnd = 0;

		let tempValue: number;

		this.square_table = [];
		for (let i = 0; i < 32; i++) {
			tempValue = 95.52 / (8128.0 / i + 100.0);

			this.square_table[i] = tempValue;
			if (tempValue > max_sqr)
				max_sqr = tempValue;
		}

		this.tnd_table = [];
		for (let i = 0; i < 204; i++) {

			tempValue = 163.67 / (24329.0 / i + 100.0);

			this.tnd_table[i] = tempValue;
			if (tempValue > max_tnd)
				max_tnd = tempValue;
		}

		this.dcValue = (max_sqr + max_tnd) / 2;
	}

	Reset() {
		this.square1.Reset();
		this.square2.Reset();
		this.triangle.Reset();
		this.noise.Reset();
		this.dpcm.Reset();
	}

	DoClock(cpuClock: number): void {
		this.square1.DoClock(cpuClock);
		this.square2.DoClock(cpuClock);
		this.triangle.DoClock(cpuClock);
		this.noise.DoClock(cpuClock);
		this.dpcm.DoClock(cpuClock);
	}

	/**
	 * 执行一个帧时钟
	 * http://wiki.nesdev.com/w/index.php/APU_Frame_Counter
	 */
	DoQuarterFrame() {
		this.square1.DoEnvelopDecayClock();
		this.square2.DoEnvelopDecayClock();

		this.triangle.DoLinerClock();

		this.noise.DoEnvelopDecayClock();
	}

	DoHalfFrame() {
		this.square1.DoSweepClock();
		this.square2.DoSweepClock();

		this.square1.DoFrameClock();
		this.square2.DoFrameClock();
		this.triangle.DoFrameClock();
		this.noise.DoFrameClock();
	}

	GetSample(): number {
		//主要根据 http://wiki.nesdev.com/w/index.php/APU_Mixer

		// let outputValue = 95.88 / (8128 / (this.square1.outputValue + this.square2.outputValue) + 100);
		// outputValue += 159.79 / ( 1 / (this.triangle.outputValue / 8227 + this.noise.outputValue / 12241 + this.dpcm.outputValue / 22638) + 100);

		let outputValue = 0.00752 * (this.square1.outputValue + this.square2.outputValue);
		outputValue += 0.00851 * this.triangle.outputValue + 0.00494 * this.noise.outputValue + 0.00335 * this.dpcm.outputValue;

		// let outputValue = this.square_table[this.square1.outputValue + this.square2.outputValue];
		// outputValue += this.tnd_table[3 * this.triangle.outputValue + 2 * this.noise.outputValue + this.dpcm.outputValue];

		return outputValue;
	}

	//#region 设定接口值
	/**
	 * 设定接口值
	 * @param address 设定地址
	 * @param value 设定值
	 */
	SetRegister(address: number, value: number) {
		switch (address) {

			// 矩形波1
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

			// 矩形波2
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

			// 三角波
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

			// 噪声波
			case 0x4010:
				this.dpcm.SetFlagsAndRate(value);
				break;
			case 0x4011:
				this.dpcm.SetDirectLoad(value);
				break;
			case 0x4012:
				this.dpcm.SetSampleAddress(value);
				break;
			case 0x4013:
				this.dpcm.SetSampleLength(value);
				break;

			// 是否启用通道
			case 0x4015:
				this.square1.SetEnabled((value & 1) != 0);
				this.square2.SetEnabled((value & 2) != 0);
				this.triangle.SetEnabled((value & 4) != 0);
				this.noise.SetEnabled((value & 8) != 0);
				this.dpcm.SetEnabled((value & 0x10) != 0);
				break;
		}
	}
	//#endregion 设定接口值

}