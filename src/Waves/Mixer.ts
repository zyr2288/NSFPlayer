import NSF from "../NSF";
import VRC6Mixer from "./VRC6/VRC6Mixer";
import C2A03Mixer from "./2A03/C2A03Mixer";
import { ChipType } from "../APU_Const";
import { EasyBuffer } from "./EasyBuffer";

export default class Mixer {

	soundChip: number = 0;
	private attenuation: number = 1;

	private chipVRC6 = false;
	private chipVRC7 = false;
	private chipFDS = false;
	private chipMMC5 = false;
	private chipNamco163 = false;
	private chipSunsoft5B = false;

	private easyBuffer: EasyBuffer;

	c2a03Mixer: C2A03Mixer;
	vrc6Mixer?: VRC6Mixer;

	constructor(nsf: NSF) {
		this.c2a03Mixer = new C2A03Mixer(nsf);
		this.easyBuffer = new EasyBuffer();
		this.Reset();
	}

	Reset() {

		this.chipVRC6 = false;
		this.chipVRC7 = false;
		this.chipFDS = false;
		this.chipMMC5 = false;
		this.chipNamco163 = false;
		this.chipSunsoft5B = false;

		this.easyBuffer.Reset();
		this.c2a03Mixer.Reset();
		this.attenuation = 1;

		if ((this.soundChip & ChipType.VRC6) != 0) {
			this.chipVRC6 = true;
			this.attenuation *= 0.8;
			this.vrc6Mixer = new VRC6Mixer();
		}

		if ((this.soundChip & ChipType.VRC7) != 0) {
			this.chipVRC7 = true;
			this.attenuation *= 0.64;
		}

		if ((this.soundChip & ChipType.MMC5) != 0) {
			this.chipMMC5 = true;
			this.attenuation *= 0.83;
		}

		if ((this.soundChip & ChipType.FDS) != 0) {
			this.chipFDS = true;
			this.attenuation *= 0.9;
		}

		if ((this.soundChip & ChipType.Namco163) != 0) {
			this.chipNamco163 = true;
			this.attenuation *= 0.7;
		}

		if ((this.soundChip & ChipType.Sunsoft5B) != 0) {
			this.chipSunsoft5B = true;
			this.attenuation *= 0.5;
		}

	}

	DoClock(cpuClock: number) {
		this.c2a03Mixer.DoClock(cpuClock);
		if (this.chipVRC6)
			(<VRC6Mixer>this.vrc6Mixer).DoClock(cpuClock);

	}

	GetSample(): number {
		let result = this.c2a03Mixer.GetSample();

		if (this.chipVRC6)
			result += (<VRC6Mixer>this.vrc6Mixer).GetSample();

		// result = this.easyBuffer.SetBuffer(result);
		return result;
	}
}