export default interface IChipMixer {
	DoClock(cpuClock: number): void;
	GetSample(): number;
}