import NSF from "./NSF";
import { ChipType } from "./APU_Const";

export default class NSFFile {

	/**NSF驱动 */
	nsf: NSF;
	/**歌曲总数 */
	songsCount: number = 0;
	/**起始播放歌曲 */
	startSong: number = 0;
	/**名称 */
	name: string = "";
	/**艺术家 */
	artist: string = "";
	/**版权方 */
	copyright: string = "";

	/**文件状态，0未载入文件，1载入文件，2重新载入新文件 */
	fileStatues: number = 0;

	/**所有BANK */
	banks: Array<Uint8Array> = [];
	/**BANK索引 */
	bankIndex = [0, 0, 0, 0, 0, 0, 0, 0];

	//芯片支持
	chip_VRC6: boolean = false;
	chip_VRC7: boolean = false;
	chip_FDS: boolean = false;
	chip_MMC5: boolean = false;
	chip_Namco163: boolean = false;
	chip_Sunsoft5B: boolean = false;

	/**载入地址 */
	loadAddress: number = 0;
	/**初始化地址 */
	initAddress: number = 0;
	/**播放地址 */
	playAddress: number = 0;

	constructor(nsf: NSF) {
		this.nsf = nsf;
	}

	/**载入文件 */
	LoadFile(data: ArrayBuffer) {
		let dataView = new Uint8Array(data);
		// N,E,S,M,$1A
		if (dataView[0] != 78 || dataView[1] != 69 || dataView[2] != 83 || dataView[3] != 77 || dataView[4] != 0x1A)
			throw Error("不是一个合法的NSF文件");

		/*let decoder = new TextDecoder("utf-8")

		let temp = Utils.RemoveZeroByte(dataView.slice(0xE, 0xE + 32));
		this.name = decoder.decode(temp);

		temp = Utils.RemoveZeroByte(dataView.slice(0x2E, 0x2E + 32));
		this.artist = decoder.decode(temp);

		temp = Utils.RemoveZeroByte(dataView.slice(0x4E, 0x4E + 32));
		this.copyright = decoder.decode(temp);*/

		this.nsf.apu.mixer.soundChip = dataView[0x7B];

		this.chip_VRC6 = (dataView[0x7B] & ChipType.VRC6) != 0;
		this.chip_VRC7 = (dataView[0x7B] & ChipType.VRC7) != 0;
		this.chip_FDS = (dataView[0x7B] & ChipType.FDS) != 0;
		this.chip_MMC5 = (dataView[0x7B] & ChipType.MMC5) != 0;
		this.chip_Namco163 = (dataView[0x7B] & ChipType.Namco163) != 0;
		this.chip_Sunsoft5B = (dataView[0x7B] & ChipType.Sunsoft5B) != 0;

		this.songsCount = dataView[0x6];
		this.startSong = dataView[0x7];

		this.loadAddress = dataView[8] | (dataView[9] << 8);
		this.initAddress = dataView[0xA] | (dataView[0xB] << 8);
		this.playAddress = dataView[0xC] | (dataView[0xD] << 8);

		let tempData = dataView.slice(0x80);

		//BANK载入数据
		let startBank = Math.floor((this.loadAddress - 0x8000) / 0x1000);
		let loadLength = 0x1000 - (this.loadAddress & 0xFFF);
		for (let index = 0, i = 0; index < tempData.length; index += 0x1000, i++) {
			if (i < startBank) {
				this.banks[i] = new Uint8Array(0x1000);
				index -= 0x1000;
				continue;
			}

			this.banks[i] = new Uint8Array(0x1000);
			if (index + loadLength <= tempData.length) {
				this.banks[i].set(tempData.slice(index, index + loadLength), 0x1000 - loadLength);
				index -= 0x1000 - loadLength;
				loadLength = 0x1000;
			} else {
				this.banks[i].set(tempData.slice(index));
			}
		}

		for (let index = 0; index < 8; index++) {
			let data = dataView[0x70 + index];
			if (data == 0)
				data = index;

			this.SwitchBank(0x5FF8 + index, data);
		}

		this.nsf.play = false;
	}

	/**切BANK */
	SwitchBank(address: number, value: number) {
		if (address >= 0x5FF8 && address <= 0x5FFF)
			this.bankIndex[address & 0x7] = value;
	}

	/**读取BANK数据 */
	ReadFileData(address: number, length: number): number {
		let tempAdd = (address & 0x7000) >> 12;
		let index = this.bankIndex[tempAdd];
		let result = this.banks[index][address & 0xFFF];
		if (length == 2)
			result |= this.ReadFileData(address + 1, 1) << 8;

		return result;
	}
}