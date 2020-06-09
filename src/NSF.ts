import CPU from "./CPU";
import APU from "./APU";
import NSFFile from "./NSFFile";
import { CPU_NTSC } from "./APU_Const";

/**
 * NSF总类
 * NSF中，CPU两个时钟 = APU一个时钟
 */
export default class NSF {

	cpu: CPU;
	apu: APU;
	nsfFile: NSFFile;

	/**执行的CPU时钟 */
	private allCycle: number = 0;
	/**临时CPU时钟 */
	private tempCycle: number = 0;

	audioContext: AudioContext = new AudioContext();

	/**缓冲区片段长度 */
	readonly bufferLength = 512;
	/**样本长度 */
	readonly sampleLength = 4096;
	/**样本掩码，sampleLength - 1 */
	readonly sampleMask = 4095;
	/**缓冲区是否准备完毕 */
	private bufferReady = false;
	/**样本缓冲 */
	private audioSamples = new Float32Array(this.sampleLength);

	audioWriteIndex = 0;
	audioReadIndex = 0;

	play: boolean = false;

	nowPlaying = 0;

	/**NSF构造函数，inputElement为文件InputElement */
	constructor() {

		this.nsfFile = new NSFFile(this);
		this.cpu = new CPU(this);
		this.apu = new APU(this);

		var script_processor = this.audioContext.createScriptProcessor(this.bufferLength, 1, 1);
		script_processor.onaudioprocess = (ev: AudioProcessingEvent) => {

			let buffer = ev.outputBuffer.getChannelData(0);
			let length = ev.outputBuffer.length;

			let tempIndex = 0;
			if (!this.play) {
				for (let index = 0; index < length; index++)
					buffer[index] = 0;

				return;
			}

			// 若采样不够数目，则进行一帧
			if (((this.audioWriteIndex - this.audioReadIndex) & this.sampleMask) < this.bufferLength) {
				this.OneFrame();
			}

			if (!this.bufferReady) {
				if (this.audioWriteIndex > length)
					this.bufferReady = true;

				return;
			}

			for (let index = 0; index < length; index++) {
				tempIndex = (this.audioReadIndex + index) & this.sampleMask;
				buffer[index] = this.audioSamples[tempIndex];
			}
			this.audioReadIndex = (this.audioReadIndex + length) & this.sampleMask;
		};
		script_processor.connect(this.audioContext.destination);
	}

	Reset() {
		this.cpu.Reset();
		this.apu.Reset();
		this.audioReadIndex = this.audioWriteIndex = 0;
		this.bufferReady = false;
	}

	private OneFrame() {
		/*setTimeout(() => {
			if (this.nsfFile.chip_VRC7) {
				(<Float32Array>this.vrc7Buffer).set((<VRC7_Mixer>this.apu.vrc7_mixer).GetSimple(), 0);
			}
		});*/
		while (true) {
			this.tempCycle = this.cpu.OneOperation();
			this.apu.sampleTime += this.tempCycle;
			this.allCycle += this.tempCycle;

			this.apu.DoClock(this.tempCycle);

			while (this.apu.sampleTime >= this.apu.SAMPLE_CPU_CLOCKS) {
				this.apu.sampleTime -= this.apu.SAMPLE_CPU_CLOCKS;
				this.SetBuffer(this.apu.mixer.GetSample());
			}

			if (this.allCycle >= CPU_NTSC) {
				this.allCycle -= CPU_NTSC;
				break;
			}
		}
		this.cpu.doNothingMode = false;
		if (this.cpu.interruptType == 2)
			this.cpu.register_PC = 0x3800;

		//Debug.UpdateEle(this.apu.noise.volume);
	}

	/**播放曲目 */
	Play(songNumber: number) {
		if (isNaN(songNumber))
			return;

		this.Reset();

		this.cpu.memory[0x3800] = 0x20;
		this.cpu.memory[0x3801] = this.nsfFile.playAddress & 0xFF;
		this.cpu.memory[0x3802] = this.nsfFile.playAddress >> 8;

		this.cpu.memory[0x3803] = 0x20;
		this.cpu.memory[0x3804] = this.nsfFile.initAddress & 0xFF;
		this.cpu.memory[0x3805] = this.nsfFile.initAddress >> 8;

		this.cpu.nmiAddress = 0x3800;

		if (songNumber < 1)
			songNumber = 1;

		if (songNumber > this.nsfFile.songsCount)
			songNumber = this.nsfFile.songsCount;

		this.nowPlaying = songNumber;
		songNumber--;

		this.cpu.register_A = songNumber;
		this.cpu.register_PC = 0x3803;

		this.play = true;
		this.audioContext.resume();
	}

	Next() {
		this.Play(++this.nowPlaying);
	}

	Preview() {
		this.Play(--this.nowPlaying);
	}

	GetSongName(): string {
		return this.nsfFile.name;
	}

	GetSongArtist(): string {
		return this.nsfFile.artist;
	}

	GetSongCopyright(): string {
		return this.nsfFile.copyright;
	}

	private SetBuffer(value: number) {
		this.audioSamples[this.audioWriteIndex] = value;
		this.audioWriteIndex++;
		this.audioWriteIndex &= this.sampleMask;
	}
}