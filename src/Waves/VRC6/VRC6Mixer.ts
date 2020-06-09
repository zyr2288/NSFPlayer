import IChipMixer from "../IChipMixer";
import Square from "./Square";
import Sawtooth from "./Sawtooth";


export default class VRC6Mixer implements IChipMixer {

	private square1: Square;
	private square2: Square;
	private sawtooth: Sawtooth;

	constructor() {
		this.square1 = new Square();
		this.square2 = new Square();
		this.sawtooth = new Sawtooth();
		this.Reset();
	}

	Reset() {
		this.square1.Reset();
		this.square2.Reset();
		this.sawtooth.Reset();
	}

	DoClock(cpuClock: number): void {
		this.square1.DoClock(cpuClock);
		this.square2.DoClock(cpuClock);
		this.sawtooth.DoClock(cpuClock);
	}

	GetSample(): number {
		return 0.00852 * (this.square1.outputValue + this.square2.outputValue + this.sawtooth.outputValue);
	}

	SetRegister(address: number, value: number) {
		switch (address) {

			case 0x9000:
				(<Square>this.square1).SetDutyAndVolume(value);
				break;
			case 0x9001:
				(<Square>this.square1).SetTimerLow(value);
				break;
			case 0x9002:
				(<Square>this.square1).SetTimerHighAndEnabled(value);
				break;

			case 0xA000:
				(<Square>this.square2).SetDutyAndVolume(value);
				break;
			case 0xA001:
				(<Square>this.square2).SetTimerLow(value);
				break;
			case 0xA002:
				(<Square>this.square2).SetTimerHighAndEnabled(value);
				break;

			case 0xB000:
				(<Sawtooth>this.sawtooth).SetStep(value);
				break;
			case 0xB001:
				(<Sawtooth>this.sawtooth).SetTimerLow(value);
				break;
			case 0xB002:
				(<Sawtooth>this.sawtooth).SetTimerHighAndEnabled(value);
				break;
		}
	}
}