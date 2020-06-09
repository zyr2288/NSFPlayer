/* 
	CPU频率为1789772.5Hz
	NTSC制式一帧为60.09914261Hz
	CPU时钟总数则为 1789772.5 / 60.09914261 * 2

	同理：PAL CPU 1662607.03
	PAL Frame Rate 50.00697891Hz
	CPU Clocks: 1662607.03 / 50.00697891 * 2

	同理：Dendy CPU 1773447.5
	PAL Frame Rate 50.00697891Hz
	CPU Clocks: 1773447.5 / 50.00697891 * 2
 */

/**NTSC制式一帧的CPU时钟总数 */
export const CPU_NTSC = 59561 / 2;
/**PAL制式一帧的CPU时钟总数 */
export const CPU_PAL = 66495 / 2;
/**Dendy制式一帧的CPU时钟总数：*/
export const CPU_Dendy = 70928 / 2;
/**帧长度计数器值 */
export const FrameCountLength = [
	0x0A, 0xFE, 0x14, 0x02, 0x28, 0x04, 0x50, 0x06,
	0xA0, 0x08, 0x3C, 0x0A, 0x0E, 0x0C, 0x1A, 0x0E,
	0x0C, 0x10, 0x18, 0x12, 0x30, 0x14, 0x60, 0x16,
	0xC0, 0x18, 0x48, 0x1A, 0x10, 0x1C, 0x20, 0x1E
];
/**
 * APU执行时钟，两个CPU时钟执行一个APU时钟
 * http://wiki.nesdev.com/w/index.php/APU_Frame_Counter
 */
export const APU_COUNT_STEP = [3728.5 * 2, 7456.5 * 2, 11185.5 * 2, 14914.5 * 2, 18640.5 * 2];

/**芯片类型 */
export const enum ChipType {
	VRC6 = 1,
	VRC7 = 2,
	FDS = 4,
	MMC5 = 8,
	Namco163 = 0x10,
	Sunsoft5B = 0x20
}

/**NES类型 */
export const enum NES_Type {
	NTSC, PAL, Dendy
}