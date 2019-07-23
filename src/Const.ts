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

class Const {
	/**NTSC制式一帧的CPU时钟总数 */
	static CPU_NTSC = 59561 / 2;
	/**PAL制式一帧的CPU时钟总数 */
	static CPU_PAL = 66495 / 2;
	/**Dendy制式一帧的CPU时钟总数：*/
	static CPU_Dendy = 70928 / 2;
}