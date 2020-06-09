import NSF from "./NSF";
import Mixer from "./Waves/Mixer";
import VRC6Mixer from "./Waves/VRC6/VRC6Mixer";
import { APU_COUNT_STEP, NES_Type, CPU_NTSC, CPU_PAL, CPU_Dendy } from "./APU_Const";

export default class APU {

	nsf: NSF;

	/**
	 * 多少个CPU频率采样一次，800 = 48000 / 60
	 * 因为WebAudio默认采样频率为48000，即一秒钟采样48000次
	 * 一秒为60帧
	 */
	public SAMPLE_CPU_CLOCKS: number;
	/**采样计数器 */
	public sampleTime = 0;

	/**
	 * APU可以自选模式，并非要根据制式改变，False为NTSC制式，True为PAL制式
	 * Flase为4-step，True为5-step
	 */
	private sequencerMode: boolean = false;
	/**Step计数器 */
	private sequencerStepCount: number = 0;
	/**最大Step */
	private sequencerStepMax: number = 4;
	/**APU计时器 */
	private apuClock = 0;

	mixer: Mixer;

	constructor(nsf: NSF) {
		this.nsf = nsf;
		this.mixer = new Mixer(nsf);
		this.SAMPLE_CPU_CLOCKS = 0;

		this.Reset();
	}

	Reset() {
		this.SAMPLE_CPU_CLOCKS = CPU_NTSC / (this.nsf.audioContext.sampleRate / 60);
		this.mixer.Reset();
	}

	/**执行一个CPU时钟 */
	DoClock(cpuClock: number) {
		this.mixer.DoClock(cpuClock);
		this.apuClock += cpuClock;
		if (this.apuClock <= APU_COUNT_STEP[this.sequencerStepCount])
			return;

		if (this.sequencerStepCount++ >= this.sequencerStepMax) {
			this.sequencerStepCount = 0;
			this.apuClock = 0;
		}

		if (this.sequencerStepCount == 1 || this.sequencerStepCount == 3) {
			this.mixer.c2a03Mixer.DoHalfFrame();
		}

		if (this.sequencerStepCount < 3 || this.sequencerStepCount == 4) {
			this.mixer.c2a03Mixer.DoQuarterFrame();
		}
	}

	SetRegister(address: number, value: number) {
		if (address >= 0x4000 && address <= 0x4015) {
			this.mixer.c2a03Mixer.SetRegister(address, value);
		} else if (address == 0x4017) {
			this.sequencerMode = (value & 0x80) != 0;
			this.sequencerStepMax = this.sequencerMode ? 4 : 3;
			this.sequencerStepCount = this.sequencerMode ? 0 : 4;
		}
	}

	/**设置扩展音源 */
	SetExpansionAudio(address: number, value: number) {
		if (this.nsf.nsfFile.chip_VRC6)
			(<VRC6Mixer>this.mixer.vrc6Mixer).SetRegister(address, value);
	}

	SwitchNESType(type: NES_Type) {

		let cpuClock = 0;
		switch (type) {
			case NES_Type.NTSC:
				cpuClock = CPU_NTSC;
				break;
			case NES_Type.PAL:
				cpuClock = CPU_PAL;
				break;
			case NES_Type.Dendy:
				cpuClock = CPU_Dendy;
				break;
		}
		this.SAMPLE_CPU_CLOCKS = cpuClock / (this.nsf.audioContext.sampleRate / 60);
		this.Reset();
	}
}