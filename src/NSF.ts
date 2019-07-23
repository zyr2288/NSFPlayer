// NSF中，CPU两个时钟 = APU一个时钟


/**NSF总类 */
class NSF {

	cpu: CPU;
	apu: APU;
	nsfFile: NSFFile;

	/**执行的CPU时钟 */
	allCycle: number = 0;
	/**临时CPU时钟 */
	tempCycle: number = 0;

	audioContext: AudioContext = new AudioContext();

	/**缓冲区片段长度 */
	readonly bufferLength = 512;
	/**样本长度 */
	readonly sampleLength = 4096;
	/**样本掩码，sampleLength - 1 */
	readonly sampleMask = 4095;
	/**缓冲区是否准备完毕 */
	bufferReady = false;
	/**样本缓冲 */
	audioSamples = new Float32Array(this.sampleLength);

	audioWriteIndex = 0;
	audioReadIndex = 0;

	play: boolean = false;

	nowPlaying = 0;

	/**NSF构造函数，inputElement为文件InputElement */
	constructor(inputElement: string) {

		this.nsfFile = new NSFFile(this);
		this.cpu = new CPU(this);
		this.apu = new APU(this);
		(<HTMLInputElement>document.getElementById(inputElement)).addEventListener("change", (event: any) => {
			let data = event.target.files[0];
			var reader = new FileReader();
			reader.readAsArrayBuffer(data);
			reader.onload = (evt: any) => {
				this.nsfFile.LoadFile(evt.target.result);
			}
		});

		var script_processor = this.audioContext.createScriptProcessor(this.bufferLength, 1, 1);
		script_processor.onaudioprocess = (ev: AudioProcessingEvent) => {
			let temp = ev.outputBuffer;
			let buffer = temp.getChannelData(0);
			let length = temp.length;

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
		while (true) {
			this.tempCycle = this.cpu.OneOperation();
			this.apu.sampleTime += this.tempCycle;
			this.allCycle += this.tempCycle;

			//这里还是采用 1 APU Clock = 2 CPU Clock进行计算
			while (this.tempCycle >= 2) {
				this.tempCycle -= 2;
				this.apu.DoClock();
				this.apu.DoFrame();
			}

			while (this.apu.sampleTime >= this.apu.SAMPLE_CPU_CLOCKS) {
				this.apu.sampleTime -= this.apu.SAMPLE_CPU_CLOCKS;
				this.SetBuffer(this.apu.Sample());
			}

			if (this.allCycle > Const.CPU_NTSC) {
				this.allCycle -= Const.CPU_NTSC;
				break;
			}
		}
		this.cpu.doNothingMode = false;
		if (this.cpu.interruptType == 2) {
			this.cpu.register_PC = 0x3800;
		}
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
	}

	Next() {
		this.Play(++this.nowPlaying);
	}

	Preview() {
		this.Play(--this.nowPlaying);
	}

	private SetBuffer(value: number) {
		this.audioSamples[this.audioWriteIndex] = value;
		this.audioWriteIndex = (this.audioWriteIndex + 1) & this.sampleMask;
	}
}