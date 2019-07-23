//#region 枚举
/**标志位枚举 */
const enum Flags {
	/**Bit:7 Negative/Sign (0=Positive, 1=Negative) */
	Flag_N = 7,
	/**Bit:6 Overflow (0=No Overflow, 1=Overflow) */
	Flag_V = 6,
	/**Bit:5 Not used (Always 1) */
	Flag_U = 5,
	/**Bit:4 Break Flag (0=IRQ/NMI, 1=RESET or BRK/PHP opcode) */
	Flag_B = 4,
	/**Bit:3 Decimal Mode (0=Normal, 1=BCD Mode for ADC/SBC opcodes) */
	Flag_D = 3,
	/**Bit:2 IRQ Disable (0=IRQ Enable, 1=IRQ Disable) */
	Flag_I = 2,
	/**Bit:1 Zero (0=Nonzero, 1=Zero) */
	Flag_Z = 1,
	/**Bit:0 Carry (0=No Carry, 1=Carry) */
	Flag_C = 0
}

/**寻址方式枚举 */
const enum FindAddressType {
	/**隐含寻址 */
	Implied = 0,
	/**立即数 */
	Immediate = 1,
	/**零页寻址 */
	ZeroPage = 2,
	/**零页X */
	ZeroPage_X = 3,
	/**零页Y */
	ZeroPage_Y = 4,
	/**绝对寻址 */
	Absolute = 5,
	/**绝对X */
	Absolute_X = 6,
	/**绝对Y */
	Absolute_Y = 7,
	/**间接寻址 */
	Indirect = 8,
	/**间接X */
	Indirect_X = 9,
	/**间接Y */
	Indirect_Y = 10,
	/**IRQ */
	IRQ = 11,
	/**NMI */
	NMI = 12,
	/**Reset */
	Reset = 13
}

/**操作 */
const enum Operations {
	PHA = 0, PHP = 1, PLA = 2, PLP = 3,												//出入栈
	ADC = 4, SBC = 5, AND = 6, EOR = 7, ORA = 8,									//加减与非或
	UsingAddress = 9, UsingRegister = 10,
	JMP = 11, JSR = 12, RTI = 13, RTS = 14,											//无条件跳转
	BPL = 15, BMI = 16, BVC = 17, BVS = 18, BCC = 19, BCS = 20, BNE = 21, BEQ = 22	//标志位跳转
}

/**预执行所干预的寄存器或地址 */
const enum PreDoRegesiter {
	Register_A = 0,
	Register_X = 1,
	Register_Y = 2,
	Register_PC = 3,
	Register_S = 4,
	Register_P = 5,
	Address = 7,
}
//#endregion 枚举

class CPU {

	//#region 变量
	/**CPU内存 */
	private nsf: NSF;
	public memory: Uint8Array = new Uint8Array(0x8000);

	/**寄存器A */
	public register_A: number = 0;
	/**寄存器X */
	private register_X: number = 0;
	/**寄存器Y */
	private register_Y: number = 0;
	/**PC寄存器 */
	public register_PC: number = 0;
	/**寄存器S */
	private register_S: number = 0;
	/**寄存器P */
	private register_P: number = 0;

	/**所有标志位 */
	private flags: boolean[] = new Array<boolean>(0x8);

	/**CPU时钟 */
	public clock: number = 0;

	/**是否启用SRAM */
	public usingSRAM: boolean = false;

	/**IRQ地址 */
	public irqAddress: number = 0;
	/**NMI地址 */
	public nmiAddress: number = 0;

	/**中断类型，0为无中断，1为下一帧输入中断，2为下一帧 */
	public interruptType: number = 0;

	/**NSF专用，在执行完成音乐程序之后，此为True */
	public doNothingMode: boolean = false;
	//#endregion 变量

	constructor(nsf: NSF) {
		this.nsf = nsf;
		this.Reset();
	}

	Reset() {
		this.ResetMemory();

		this.flags[Flags.Flag_N] = false;
		this.flags[Flags.Flag_V] = false;
		this.flags[Flags.Flag_U] = true;
		this.flags[Flags.Flag_B] = false;
		this.flags[Flags.Flag_D] = false;
		this.flags[Flags.Flag_I] = true;
		this.flags[Flags.Flag_Z] = false;
		this.flags[Flags.Flag_C] = false;

		this.register_P = 0x24;

		this.interruptType = 0;
		this.clock = 0;

		//this.irqAddress = this.GetMemoryData(0xFFFE, 2);
		//this.nmiAddress = this.GetMemoryData(0xFFFA, 2);
		//this.register_PC = this.GetMemoryData(0xFFFC, 2);

		this.register_A = this.register_X = this.register_Y = 0;
		this.register_S = 0xFF;
	}

	//#region 执行一行操作
	/**
	 * 执行一行操作
	 * @param operation 操作指令
	 */
	public DoOperation(operation: number) {
		let tempAdd: number = 0;
		switch (operation) {

			//#region TAY TAX TSX TYA TXA TXS 操作
			case 0xA8:		//TAY
				this.register_Y = this.OperationToRegister(this.register_A);
				break;
			case 0xAA:		//TAX
				this.register_X = this.OperationToRegister(this.register_A);
				break;
			case 0xBA:		//TSX
				this.register_X = this.OperationToRegister(this.register_X);
				break;
			case 0x98:		//TYA
				this.register_A = this.OperationToRegister(this.register_Y);
				break;
			case 0x8A:		//TXA
				this.register_A = this.OperationToRegister(this.register_X);
				break;
			case 0x9A:		//TXS
				this.register_S = this.register_X;
				this.clock = 2;
				this.register_PC++;
				break;
			//#endregion TAY TAX TSX TYA TXA TXS 操作
			//#region LDA LDX LDY 操作
			case 0xA9:		//LDA #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.register_A = this.OperationLD(tempAdd, 2);
				break;
			case 0xA5:		//LDA nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.register_A = this.OperationLD(tempAdd, 3);
				break;
			case 0xB5:		//LDA nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.register_A = this.OperationLD((tempAdd + this.register_X) & 0xFF, 4);
				break;
			case 0xAD:		//LDA nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.register_A = this.OperationLD(tempAdd, 4);
				break;
			case 0xBD:		//LDA nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.register_A = this.OperationLD(tempAdd + this.register_X, 4, (tempAdd & 0xFF) + this.register_X > 0xFF)
				break;
			case 0xB9:		//LDA nnnn,Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.register_A = this.OperationLD(tempAdd + this.register_Y, 4, (tempAdd & 0xFF) + this.register_Y > 0xFF)
				break;
			case 0xA1:		//LDA (nn,X)
				tempAdd = this.FindAddress(FindAddressType.Indirect_X);
				this.register_A = this.OperationLD(tempAdd, 6);
				break;
			case 0xB1:		//LDA (nn),Y
				tempAdd = this.FindAddress(FindAddressType.Indirect_Y);
				this.register_A = this.OperationLD(tempAdd + this.register_Y, 5, (tempAdd & 0xFF) + this.register_Y > 0xFF)
				break;

			case 0xA2:		//LDX #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.register_X = this.OperationLD(tempAdd, 2);
				break;
			case 0xA6:		//LDX nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.register_X = this.OperationLD(tempAdd, 3);
				break;
			case 0xB6:		//LDX nn,Y
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_Y);
				this.register_X = this.OperationLD((tempAdd + this.register_Y) & 0xFF, 4);
				break;
			case 0xAE:		//LDX nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.register_X = this.OperationLD(tempAdd, 4);
				break;
			case 0xBE:		//LDX nnnn,Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.register_X = this.OperationLD(tempAdd + this.register_Y, 4, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;

			case 0xA0:		//LDY #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.register_Y = this.OperationLD(tempAdd, 2)
				break;
			case 0xA4:		//LDY nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.register_Y = this.OperationLD(tempAdd, 3);
				break;
			case 0xB4:		//LDY nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.register_Y = this.OperationLD((tempAdd + this.register_X) & 0xFF, 4);
				break;
			case 0xAC:		//LDY nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.register_Y = this.OperationLD(tempAdd, 4);
				break;
			case 0xBC:		//LDY nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.register_Y = this.OperationLD(tempAdd + this.register_X, 4, (tempAdd & 0xFF) + this.register_X > 0xFF);
				break;
			//#endregion LDA LDX LDY 操作
			//#region STA STX STY 操作
			case 0x85:		//STA nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationST(tempAdd, 3, this.register_A);
				break;
			case 0x95:		//STA nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationST((tempAdd + this.register_X) & 0xFF, 4, this.register_A);
				break;
			case 0x8D:		//STA nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationST(tempAdd, 4, this.register_A);
				break;
			case 0x9D:		//STA nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationST(tempAdd + this.register_X, 5, this.register_A);
				break;
			case 0x99:		//STA nnnn,Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.OperationST(tempAdd + this.register_Y, 5, this.register_A);
				break;
			case 0x81:		//STA (nn,X)
				tempAdd = this.FindAddress(FindAddressType.Indirect_X);
				this.OperationST(tempAdd, 6, this.register_A);
				break;
			case 0x91:		//STA (nn),Y
				tempAdd = this.FindAddress(FindAddressType.Indirect_Y);
				this.OperationST(tempAdd + this.register_Y, 6, this.register_A);
				break;

			case 0x86:		//STX nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationST(tempAdd, 3, this.register_X);
				break;
			case 0x96:		//STX nn,Y
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_Y);
				this.OperationST((tempAdd + this.register_Y) & 0xFF, 4, this.register_X);
				break;
			case 0x8E:		//STX nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationST(tempAdd, 4, this.register_X);
				break;

			case 0x84:		//STY nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationST(tempAdd, 3, this.register_Y);
				break;
			case 0x94:		//STY nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationST((tempAdd + this.register_X) & 0xFF, 4, this.register_Y);
				break;
			case 0x8C:		//STY nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationST(tempAdd, 4, this.register_Y);
				break;
			//#endregion STA STX STY 操作
			//#region PHA PHP PLA PLP 操作
			case 0x48:
				this.OperationP(Operations.PHA);
				break;
			case 0x08:
				this.OperationP(Operations.PHP);
				break;
			case 0x68:
				this.OperationP(Operations.PLA);
				break;
			case 0x28:
				this.OperationP(Operations.PLP);
				break;
			//#endregion PHA PHP PLA PLP 操作
			//#region ADC SBC 操作
			case 0x69:		//ADC #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.OperationADCOrSBC(tempAdd, 2, Operations.ADC);
				break;
			case 0x65:		//ADC nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationADCOrSBC(tempAdd, 3, Operations.ADC);
				break;
			case 0x75:		//ADC nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationADCOrSBC((tempAdd + this.register_X) & 0xFF, 4, Operations.ADC);
				break;
			case 0x6D:		//ADC nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationADCOrSBC(tempAdd, 4, Operations.ADC);
				break;
			case 0x7D:		//ADC nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationADCOrSBC(tempAdd + this.register_X, 4, Operations.ADC, (tempAdd & 0xFF) + this.register_X > 0xFF);
				break;
			case 0x79:		//ADC nnnn,Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.OperationADCOrSBC(tempAdd + this.register_Y, 4, Operations.ADC, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;
			case 0x61:		//ADC (nn,X)
				tempAdd = this.FindAddress(FindAddressType.Indirect_X);
				this.OperationADCOrSBC(tempAdd, 6, Operations.ADC);
				break;
			case 0x71:		//ADC (nn),Y
				tempAdd = this.FindAddress(FindAddressType.Indirect_Y);
				this.OperationADCOrSBC(tempAdd + this.register_Y, 5, Operations.ADC, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;

			case 0xE9:		//SBC #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.OperationADCOrSBC(tempAdd, 2, Operations.SBC);
				break;
			case 0xE5:		//SBC nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationADCOrSBC(tempAdd, 3, Operations.SBC);
				break;
			case 0xF5:		//SBC nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationADCOrSBC(tempAdd + this.register_X, 4, Operations.SBC);
				break;
			case 0xED:		//SBC nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationADCOrSBC(tempAdd, 4, Operations.SBC);
				break;
			case 0xFD:		//SBC nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationADCOrSBC(tempAdd + this.register_X, 4, Operations.SBC, (tempAdd & 0xFF) + this.register_X > 0xFF);
				break;
			case 0xF9:		//SBC nnnn,Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.OperationADCOrSBC(tempAdd + this.register_Y, 4, Operations.SBC, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;
			case 0xE1:		//SBC (nn,X)
				tempAdd = this.FindAddress(FindAddressType.Indirect_X);
				this.OperationADCOrSBC(tempAdd, 6, Operations.SBC);
				break;
			case 0xF1:		//SBC (nn),Y
				tempAdd = this.FindAddress(FindAddressType.Indirect_Y);
				this.OperationADCOrSBC(tempAdd + this.register_Y, 5, Operations.SBC, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;
			//#endregion ADC SBC 操作
			//#region AND EOR ORA 操作
			case 0x29:		//AND #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.OperationANDOrEOROrORA(tempAdd, 2, Operations.AND);
				break;
			case 0x25:		//AND nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationANDOrEOROrORA(tempAdd, 3, Operations.AND);
				break;
			case 0x35:		//AND nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationANDOrEOROrORA(tempAdd + this.register_X, 4, Operations.AND);
				break;
			case 0x2D:		//AND nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationANDOrEOROrORA(tempAdd, 4, Operations.AND);
				break;
			case 0x3D:		//AND nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationANDOrEOROrORA(tempAdd + this.register_X, 4, Operations.AND, (tempAdd & 0xFF) + this.register_X > 0xFF);
				break;
			case 0x39:		//AND nnnn,Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.OperationANDOrEOROrORA(tempAdd + this.register_Y, 4, Operations.AND, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;
			case 0x21:		//AND (nn,X)
				tempAdd = this.FindAddress(FindAddressType.Indirect_X);
				this.OperationANDOrEOROrORA(tempAdd, 6, Operations.AND);
				break;
			case 0x31:		//AND (nn),Y
				tempAdd = this.FindAddress(FindAddressType.Indirect_Y);
				this.OperationANDOrEOROrORA(tempAdd + this.register_Y, 5, Operations.AND, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;

			case 0x49:		//EOR #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.OperationANDOrEOROrORA(tempAdd, 2, Operations.EOR);
				break;
			case 0x45:		//EOR nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationANDOrEOROrORA(tempAdd, 3, Operations.EOR);
				break;
			case 0x55:		//EOR nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationANDOrEOROrORA(tempAdd + this.register_X, 4, Operations.EOR);
				break;
			case 0x4D:		//EOR nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationANDOrEOROrORA(tempAdd, 4, Operations.EOR);
				break;
			case 0x5D:		//EOR nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationANDOrEOROrORA(tempAdd + this.register_X, 4, Operations.EOR, (tempAdd & 0xFF) + this.register_X > 0xFF);
				break;
			case 0x59:		//EOR nnnn,Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.OperationANDOrEOROrORA(tempAdd + this.register_Y, 4, Operations.EOR, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;
			case 0x41:		//EOR (nn,X)
				tempAdd = this.FindAddress(FindAddressType.Indirect_X);
				this.OperationANDOrEOROrORA(tempAdd, 6, Operations.EOR);
				break;
			case 0x51:		//EOR (nn),Y
				tempAdd = this.FindAddress(FindAddressType.Indirect_Y);
				this.OperationANDOrEOROrORA(tempAdd + this.register_Y, 5, Operations.EOR, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;

			case 0x09:		//ORA #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.OperationANDOrEOROrORA(tempAdd, 2, Operations.ORA);
				break;
			case 0x05:		//ORA nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationANDOrEOROrORA(tempAdd, 3, Operations.ORA);
				break;
			case 0x15:		//ORA nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationANDOrEOROrORA(tempAdd + this.register_X, 4, Operations.ORA);
				break;
			case 0x0D:		//ORA nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationANDOrEOROrORA(tempAdd, 4, Operations.ORA);
				break;
			case 0x1D:		//ORA nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationANDOrEOROrORA(tempAdd + this.register_X, 4, Operations.ORA, (tempAdd & 0xFF) + this.register_X > 0xFF);
				break;
			case 0x19:		//ORA nnnn,Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.OperationANDOrEOROrORA(tempAdd + this.register_Y, 4, Operations.ORA, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;
			case 0x01:		//ORA (nn,X)
				tempAdd = this.FindAddress(FindAddressType.Indirect_X);
				this.OperationANDOrEOROrORA(tempAdd, 6, Operations.ORA);
				break;
			case 0x11:		//ORA (nn),Y
				tempAdd = this.FindAddress(FindAddressType.Indirect_Y);
				this.OperationANDOrEOROrORA(tempAdd + this.register_Y, 5, Operations.ORA, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;
			//#endregion AND EOR ORA 操作
			//#region CMP CPX CPY 操作
			case 0xC9:		//CMP #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.OperationCP(this.register_A, tempAdd, 2);
				break;
			case 0xC5:		//CMP nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationCP(this.register_A, tempAdd, 3);
				break;
			case 0xD5:		//CMP nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationCP(this.register_A, (tempAdd + this.register_X) & 0xFF, 2);
				break;
			case 0xCD:		//CMP nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationCP(this.register_A, tempAdd, 4);
				break;
			case 0xDD:		//CMP nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationCP(this.register_A, tempAdd + this.register_X, 4, (tempAdd & 0xFF) + this.register_X > 0xFF);
				break;
			case 0xD9:		//CMP nnnn.Y
				tempAdd = this.FindAddress(FindAddressType.Absolute_Y);
				this.OperationCP(this.register_A, tempAdd + this.register_Y, 4, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;
			case 0xC1:		//CMP (nn,X)
				tempAdd = this.FindAddress(FindAddressType.Indirect_X);
				this.OperationCP(this.register_A, tempAdd, 6);
				break;
			case 0xD1:		//CMP (nn,Y)
				tempAdd = this.FindAddress(FindAddressType.Indirect_Y);
				this.OperationCP(this.register_A, tempAdd + this.register_Y, 5, (tempAdd & 0xFF) + this.register_Y > 0xFF);
				break;

			case 0xE0:		//CPX #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.OperationCP(this.register_X, tempAdd, 2);
				break;
			case 0xE4:		//CPX nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationCP(this.register_X, tempAdd, 3);
				break;
			case 0xEC:		//CPX nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationCP(this.register_X, tempAdd, 4);
				break;

			case 0xC0:		//CPY #nn
				tempAdd = this.FindAddress(FindAddressType.Immediate);
				this.OperationCP(this.register_Y, tempAdd, 2);
				break;
			case 0xC4:		//CPY nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationCP(this.register_Y, tempAdd, 3);
				break;
			case 0xCC:		//CPY nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationCP(this.register_Y, tempAdd, 4);
				break;
			//#endregion CMP CPX CPY 操作
			//#region BIT 操作
			case 0x24:		//BIT nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationBIT(tempAdd, 3);
				break;
			case 0x2C:		//BIT nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationBIT(tempAdd, 4);
				break;
			//#endregion BIT 操作
			//#region INC INX INY DEC DEX DEY 操作
			case 0xE6:		//INC nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationINCOrDec(5, 1, tempAdd, Operations.UsingAddress);
				break;
			case 0xF6:		//INC nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationINCOrDec(6, 1, (tempAdd + this.register_X) & 0xFF, Operations.UsingAddress);
				break;
			case 0xEE:		//INC nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationINCOrDec(6, 1, tempAdd, Operations.UsingAddress);
				break;
			case 0xFE:		//INC nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationINCOrDec(7, 1, tempAdd + this.register_X, Operations.UsingAddress);
				break;

			case 0xE8:		//INX
				this.register_X = this.OperationINCOrDec(2, 1, this.register_X, Operations.UsingRegister);
				break;

			case 0xC8:		//INY
				this.register_Y = this.OperationINCOrDec(2, 1, this.register_Y, Operations.UsingRegister);
				break;

			case 0xC6:		//DEC nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationINCOrDec(5, -1, tempAdd, Operations.UsingAddress);
				break;
			case 0xD6:		//DEC nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationINCOrDec(6, -1, (tempAdd + this.register_X) & 0xFF, Operations.UsingAddress);
				break;
			case 0xCE:		//DEC nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationINCOrDec(6, -1, tempAdd, Operations.UsingAddress);
				break;
			case 0xDE:		//DEC nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationINCOrDec(7, -1, tempAdd + this.register_X, Operations.UsingAddress);
				break;

			case 0xCA:		//DEX
				this.register_X = this.OperationINCOrDec(2, -1, this.register_X, Operations.UsingRegister);
				break;

			case 0x88:		//DEY
				this.register_Y = this.OperationINCOrDec(2, -1, this.register_Y, Operations.UsingRegister);
				break;
			//#endregion INC INX INY DEC DEX DEY 操作
			//#region ASL LSR ROL ROR 操作
			case 0x0A:		//ASL
				this.OperationShift(2, false, true);
				break;
			case 0x06:		//ASL nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationShift(5, false, true, tempAdd);
				break;
			case 0x16:		//ASL nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationShift(6, false, true, (tempAdd + this.register_X) & 0xFF);
				break;
			case 0x0E:		//ASL nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationShift(6, false, true, tempAdd);
				break;
			case 0x1E:		//ASL nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationShift(7, false, true, tempAdd + this.register_X);
				break;

			case 0x4A:		//LSR
				this.OperationShift(2, false, false);
				break;
			case 0x46:		//LSR nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationShift(5, false, false, tempAdd);
				break;
			case 0x56:		//LSR nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationShift(6, false, false, (tempAdd + this.register_X) & 0xFF);
				break;
			case 0x4E:		//LSR nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationShift(6, false, false, tempAdd);
				break;
			case 0x5E:		//LSR nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationShift(7, false, false, tempAdd + this.register_X);
				break;

			case 0x2A:		//ROL
				this.OperationShift(2, true, true);
				break;
			case 0x26:		//ROL nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationShift(5, true, true, tempAdd);
				break;
			case 0x36:		//ROL nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationShift(6, true, true, (tempAdd + this.register_X) & 0xFF);
				break;
			case 0x2E:		//ROL nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationShift(6, true, true, tempAdd);
				break;
			case 0x3E:		//ROL nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationShift(7, true, true, tempAdd + this.register_X);
				break;

			case 0x6A:		//ROR
				this.OperationShift(2, true, false);
				break;
			case 0x66:		//ROR nn
				tempAdd = this.FindAddress(FindAddressType.ZeroPage);
				this.OperationShift(5, true, false, tempAdd);
				break;
			case 0x76:		//ROR nn,X
				tempAdd = this.FindAddress(FindAddressType.ZeroPage_X);
				this.OperationShift(6, true, false, (tempAdd + this.register_X) & 0xFF);
				break;
			case 0x6E:		//ROR nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationShift(6, true, false, tempAdd);
				break;
			case 0x7E:		//ROR nnnn,X
				tempAdd = this.FindAddress(FindAddressType.Absolute_X);
				this.OperationShift(7, true, false, tempAdd + this.register_X);
				break;
			//#endregion ASL LSR ROL ROR 操作
			//#region JMP JSR RTI RTS 操作
			case 0x4C:		//JMP nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationJMPOrJSROrBack(3, Operations.JMP, tempAdd);
				break;
			case 0x6C:		//JMP (nnnn)
				tempAdd = this.FindAddress(FindAddressType.Indirect);
				this.OperationJMPOrJSROrBack(5, Operations.JMP, tempAdd);
				break;
			case 0x20:		//JSR nnnn
				tempAdd = this.FindAddress(FindAddressType.Absolute);
				this.OperationJMPOrJSROrBack(6, Operations.JSR, tempAdd);
				break;
			case 0x40:		//RTI
				this.OperationJMPOrJSROrBack(6, Operations.RTI);
				break;
			case 0x60:		//RTS
				this.OperationJMPOrJSROrBack(6, Operations.RTS);
				break;
			//#endregion JMP JSR RTI RTS 操作
			//#region BPL BMI BVC BVS BCC BCS BNE BEQ 操作
			case 0x10:		//BPL nn
				this.OperationBXX(Operations.BPL);
				break;
			case 0x30:		//BMI nn
				this.OperationBXX(Operations.BMI);
				break;
			case 0x50:		//BVC nn
				this.OperationBXX(Operations.BVC);
				break;
			case 0x70:		//BVS nn
				this.OperationBXX(Operations.BVS);
				break;
			case 0x90:		//BCC nn
				this.OperationBXX(Operations.BCC);
				break;
			case 0xB0:		//BCS nn
				this.OperationBXX(Operations.BCS);
				break;
			case 0xD0:		//BNE nn
				this.OperationBXX(Operations.BNE);
				break;
			case 0xF0:		//BEQ nn
				this.OperationBXX(Operations.BEQ);
				break;
			//#endregion BPL BMI BVC BVS BCC BCS BNE BEQ 操作
			//#region BRK 操作
			case 0x00:		//BRK
				this.flags[Flags.Flag_B] = true;
				this.DataPush(this.register_PC + 1, 2);
				this.DataPush(this.register_P, 1);
				this.flags[Flags.Flag_I] = true;
				this.register_PC = this.FindAddress(FindAddressType.IRQ);
				this.clock = 7;
				break;
			//#endregion BRK 操作
			//#region CLC CLI CLD CLV SEC SEI SED 操作
			case 0x18:		//CLC
				this.OperationFlags(Flags.Flag_C, false);
				break;
			case 0x58:		//CLI
				this.OperationFlags(Flags.Flag_I, false);
				break;
			case 0xD8:		//CLD
				this.OperationFlags(Flags.Flag_D, false);
				break;
			case 0xB8:		//CLV
				this.OperationFlags(Flags.Flag_V, false);
				break;
			case 0x38:		//SEC
				this.OperationFlags(Flags.Flag_C, true);
				break;
			case 0x78:		//SEI
				this.OperationFlags(Flags.Flag_I, true);
				break;
			case 0xF8:		//SED
				this.OperationFlags(Flags.Flag_D, true);
				break;
			//#endregion CLC CLI CLD CLV SEC SEI SED 操作
			//#region NOP 操作
			case 0xEA:
				this.clock = 2;
				this.register_PC++;
				break;
			//#endregion NOP 操作

			default:
				this.clock = 4;
				throw Error(operation + " " + this.register_PC.toString(16));
			//break;
		}
	}
	//#endregion 执行一行操作

	//#region 操作指令
	/**
	 * TAY TAX TSX TYA TXA 操作
	 * @param opNum 操作数
	 */
	private OperationToRegister(opNum: number): number {
		this.AddClock(2);
		this.flags[Flags.Flag_N] = (opNum & 0x80) != 0;
		this.flags[Flags.Flag_Z] = opNum == 0;
		this.register_PC++;
		return opNum;
	}

	/**
	 * LDA LDX LDY操作
	 * @param opNum 操作数
	 * @param clock CPU占用时钟
	 * @param crossPage 是否越页
	 */
	private OperationLD(address: number, clock: number, crossPage: boolean = false): number {
		this.AddClock(crossPage ? clock + 1 : clock);
		let result: number = this.GetMemoryData(address, 1);
		this.flags[Flags.Flag_N] = (result & 0x80) != 0;
		this.flags[Flags.Flag_Z] = result == 0;
		return result;
	}

	/**
	 * STA STX STY操作
	 * @param address 地址
	 * @param clock CPU时钟
	 * @param value 值
	 */
	private OperationST(address: number, clock: number, value: number) {
		this.AddClock(clock);
		this.SetMemoryData(address, value);
	}

	/**
	 * PHA PHP PLA PLP操作
	 * @param clock CPU时钟
	 * @param value 值
	 * @param type 类型，true为入栈，false为出栈
	 */
	private OperationP(type: Operations): number {
		let result = 0;
		switch (type) {
			case Operations.PHA:
				this.AddClock(3);
				this.DataPush(this.register_A, 1);
				break;
			case Operations.PHP:
				this.AddClock(3);
				this.register_P = this.ReadRegisterP();
				this.DataPush(this.register_P, 1);
				break;
			case Operations.PLA:
				this.AddClock(4);
				this.register_A = this.DataPull(1);
				this.flags[Flags.Flag_N] = (this.register_A & 0x80) != 0;
				this.flags[Flags.Flag_Z] = this.register_A == 0;
				break;
			case Operations.PLP:
				this.AddClock(4);
				this.SetRegisterP(this.DataPull(1));
				this.flags[Flags.Flag_B] = true;
				this.flags[Flags.Flag_U] = true;
				break;
		}
		this.register_PC++;
		return result;
	}

	/**
	 * ADC SBC 操作
	 * @param address 地址
	 * @param clock CPU时钟
	 * @param opType 操作类型
	 * @param crossPage 是否跨页
	 */
	private OperationADCOrSBC(address: number, clock: number, opType: Operations, crossPage: boolean = false) {
		let temp: number = this.GetMemoryData(address, 1);
		let FlagC: number = this.flags[Flags.Flag_C] ? 1 : 0;

		this.AddClock(crossPage ? clock + 1 : clock);

		switch (opType) {
			case Operations.ADC:
				this.register_A = this.register_A + FlagC + temp;
				this.flags[Flags.Flag_C] = this.register_A > 0xFF;
				//this.flags[Flags.Flag_V] = (((this.register_A ^ temp) & 0x80) === 0 && ((this.register_A ^ temp) & 0x80) !== 0);
				break;
			case Operations.SBC:
				this.register_A = this.register_A + FlagC - 1 - temp;
				this.flags[Flags.Flag_C] = this.register_A > -1;
				//this.flags[Flags.Flag_V] = (((this.register_A ^ temp) & 0x80) !== 0 && ((this.register_A ^ temp) & 0x80) !== 0);
				break;
		}
		this.flags[Flags.Flag_V] = (temp & 0x80) === (this.register_A & 0x80);

		this.register_A &= 0xFF;

		this.flags[Flags.Flag_N] = (this.register_A & 0x80) !== 0;
		this.flags[Flags.Flag_Z] = this.register_A === 0;
	}

	/**
	 * AND EOR ORA 操作
	 * @param address 地址
	 * @param clock CPU时钟
	 * @param opType 操作类型
	 * @param crossPage 是否跨页
	 */
	private OperationANDOrEOROrORA(address: number, clock: number, opType: Operations, crossPage: boolean = false) {
		this.AddClock(crossPage ? clock + 1 : clock);
		let temp: number = this.GetMemoryData(address, 1);

		switch (opType) {
			case Operations.AND:
				this.register_A &= temp;
				break;
			case Operations.EOR:
				this.register_A ^= temp;
				break;
			case Operations.ORA:
				this.register_A |= temp;
				break;
		}

		this.flags[Flags.Flag_N] = (this.register_A & 0x80) != 0;
		this.flags[Flags.Flag_Z] = this.register_A == 0;
	}

	/**
	 * CMP CPX CPY 操作
	 * @param register 传入比较数
	 * @param address 地址
	 * @param clock CPU时钟
	 * @param crossPage 是否跨页
	 */
	private OperationCP(register: number, address: number, clock: number, crossPage: boolean = false) {
		this.AddClock(crossPage ? clock + 1 : clock);

		let temp: number = this.GetMemoryData(address, 1);

		let temp2: number = register - temp;

		this.flags[Flags.Flag_C] = temp2 > -1;

		temp2 &= 0xFF;
		this.flags[Flags.Flag_N] = (temp2 & 0x80) != 0;
		this.flags[Flags.Flag_Z] = temp2 == 0;
	}

	/**
	 * BIT 操作
	 * @param address 地址
	 * @param clock CPU时钟
	 */
	private OperationBIT(address: number, clock: number) {
		this.AddClock(clock);
		let temp: number = this.GetMemoryData(address, 1);

		let temp2: number = this.register_A & temp;

		this.flags[Flags.Flag_N] = (temp & 0x80) != 0;
		this.flags[Flags.Flag_Z] = temp2 == 0;
		this.flags[Flags.Flag_V] = (temp & 0x40) != 0;
	}

	/**
	 * INC INX INY DEC DEX DEY 操作
	 * @param clock CPU时钟
	 * @param plusNumber 加减数
	 * @param addOrReg 地址或寄存器
	 * @param opType 操作方法
	 */
	private OperationINCOrDec(clock: number, plusNumber: number, addOrReg: number, opType: Operations): number {
		let result = 0;
		let temp: number;
		this.AddClock(clock);
		switch (opType) {
			case Operations.UsingAddress:
				temp = (this.GetMemoryData(addOrReg, 1) + plusNumber) & 0xFF;
				this.flags[Flags.Flag_N] = (temp & 0x80) !== 0;
				this.flags[Flags.Flag_Z] = temp === 0;
				this.SetMemoryData(addOrReg, temp);
				break;
			case Operations.UsingRegister:
				temp = (addOrReg + plusNumber) & 0xFF;
				this.flags[Flags.Flag_N] = (temp & 0x80) !== 0;
				this.flags[Flags.Flag_Z] = temp === 0;
				result = temp;
				this.register_PC++;
				break;
		}
		return result;
	}

	/**
	 * ASL LSR ROL ROR 操作
	 * @param clock CPU时钟
	 * @param usingFlagC 是否使用标志位C，True为ROL或ROR
	 * @param isLeft 是否是左移
	 * @param addOrReg 地址或寄存器
	 */
	private OperationShift(clock: number, usingFlagC: boolean, isLeft: boolean, addOrReg: number = -1) {
		this.AddClock(clock);

		//位移前
		let temp: number = addOrReg == -1 ? this.register_A : this.GetMemoryData(addOrReg, 1);

		let FlagC: number = isLeft ? 0x01 : 0x80;
		FlagC = this.flags[Flags.Flag_C] && usingFlagC ? FlagC : 0;

		if (isLeft) {
			this.flags[Flags.Flag_C] = (temp & 0x80) != 0;
			temp <<= 1;
			temp |= FlagC;
		} else {
			this.flags[Flags.Flag_C] = (temp & 0x01) != 0;
			temp >>= 1;
			temp |= FlagC;
		}

		temp &= 0xFF;

		this.flags[Flags.Flag_N] = (temp & 0x80) != 0;
		this.flags[Flags.Flag_Z] = temp == 0;

		if (addOrReg == -1) {
			this.register_A = temp;
			this.register_PC++;
		} else {
			this.SetMemoryData(addOrReg, temp);
		}
	}

	/**
	 * JMP JSR RTI RTS 操作
	 * @param address 地址
	 * @param clock CPU时钟
	 */
	private OperationJMPOrJSROrBack(clock: number, opType: Operations, address: number = -1) {
		this.AddClock(clock);
		switch (opType) {
			case Operations.JMP:
				this.register_PC = address;
				break;
			case Operations.JSR:
				//寻址时已经 PC + 3
				this.DataPush((this.register_PC - 1) & 0xFFFF, 2);
				this.register_PC = address;
				break;
			case Operations.RTI:
				this.SetRegisterP(this.DataPull(1));
				this.register_PC = this.DataPull(2);
				break;
			case Operations.RTS:
				this.register_PC = this.DataPull(2) + 1;
				if (this.register_PC == 0x3803 || this.register_PC == 0x3806) {
					this.doNothingMode = true;
					this.interruptType = 2;
				}
				break;
		}
	}

	/**
	 * BPL BMI BVC BVS BCC BCS BNE BEQ 操作
	 * @param address 地址
	 * @param opType 操作类型
	 */
	private OperationBXX(opType: Operations) {
		//这里用零页寻址，直接找出后面的数
		let temp: number = this.FindAddress(FindAddressType.ZeroPage);
		let crossPage: boolean = false;

		if (temp > 0x7F) {
			crossPage = ((this.register_PC & 0xFF) - (temp ^ 0xFF)) < 0;
			temp = this.register_PC - (temp ^ 0xFF) - 1;
		} else {
			crossPage = ((this.register_PC & 0xFF) + temp) > 0xFF
			temp = this.register_PC + temp;
		}

		let clock: number = 2;
		let flagCondition: boolean = true;

		switch (opType) {
			case Operations.BPL:
				flagCondition = !this.flags[Flags.Flag_N];
				break;
			case Operations.BMI:
				flagCondition = this.flags[Flags.Flag_N];
				break;
			case Operations.BVC:
				flagCondition = !this.flags[Flags.Flag_V];
				break;
			case Operations.BVS:
				flagCondition = this.flags[Flags.Flag_V];
				break;
			case Operations.BCC:
				flagCondition = !this.flags[Flags.Flag_C];
				break;
			case Operations.BCS:
				flagCondition = this.flags[Flags.Flag_C];
				break;
			case Operations.BNE:
				flagCondition = !this.flags[Flags.Flag_Z];
				break;
			case Operations.BEQ:
				flagCondition = this.flags[Flags.Flag_Z];
				break;
		}
		if (flagCondition) {
			this.register_PC = temp;
			clock++;
		}

		if (crossPage)
			clock++;

		this.AddClock(clock);
	}

	/**
	 * 设定标志位值
	 * @param flag 标志位
	 * @param value 值
	 */
	private OperationFlags(flag: Flags, value: boolean) {
		this.AddClock(2);
		this.flags[flag] = value;
		this.register_PC++;
	}
	//#endregion 操作指令

	//#region 寻找地址，获取地址值或设置地址值
	/**
	 * 查找操作指令后的数
	 * @param type 寻址类型
	 */
	private FindAddress(type: FindAddressType): number {
		let address = 0;
		switch (type) {
			case FindAddressType.Implied:		//在这个函数不使用
				break;
			case FindAddressType.Immediate:
				address = this.register_PC + 1;
				this.register_PC += 2;
				break;
			case FindAddressType.ZeroPage:
			case FindAddressType.ZeroPage_X:
			case FindAddressType.ZeroPage_Y:
				address = this.GetMemoryData(this.register_PC + 1, 1);
				this.register_PC += 2;
				break;
			case FindAddressType.Indirect:
				address = this.GetMemoryData(this.register_PC + 1, 2);
				address = this.GetMemoryData(address, 2);
				this.register_PC += 3;
				break;
			case FindAddressType.Indirect_X:
				address = this.GetMemoryData(this.register_PC + 1, 1)
				address = this.GetMemoryData(address + this.register_X, 2);
				this.register_PC += 2;
				break;
			case FindAddressType.Indirect_Y:
				address = this.GetMemoryData(this.register_PC + 1, 1)
				address = this.GetMemoryData(address, 2);
				this.register_PC += 2;
				break;
			case FindAddressType.Absolute:
			case FindAddressType.Absolute_X:
			case FindAddressType.Absolute_Y:
				address = this.GetMemoryData(this.register_PC + 1, 2);
				this.register_PC += 3;
				break;
			case FindAddressType.IRQ:
				address = this.GetMemoryData(0xFFFE, 2);
				break;
			case FindAddressType.NMI:
				address = this.GetMemoryData(0xFFFA, 2);
				break;
			case FindAddressType.Reset:
				address = this.GetMemoryData(0xFFFC, 2);
				break;
		}
		return address;
	}
	//#endregion 寻找地址，获取地址值或设置地址值

	//#region 获取或设置内存某个的值
	/**
	 * 获取内存某个的值
	 * @param address 地址
	 * @param length 长度
	 */
	private GetMemoryData(address: number, length: number): number {
		let result: number = 0;
		if (address < 0x1000) {
			result = this.memory[address];
			if (length == 2)
				result |= this.memory[address + 1] << 8;
		} else if (address >= 3800 && address <= 0x38ff) {
			result = this.memory[address];
			if (length == 2)
				result |= this.memory[address + 1] << 8;
		} else if (address > 0x7FFF) {
			result = this.nsf.nsfFile.ReadFileData(address, length);
		}
		return result;
	}

	/**
	 * 设定内存值
	 * @param address 地址
	 * @param value 值
	 */
	private SetMemoryData(address: number, value: number) {
		if (address < 0x2000) {
			this.memory[address & 0xFFFF] = value;
		} else if (address < 0x6000) {
			switch (address) {
				case 0x4000:
				case 0x4001:
				case 0x4002:
				case 0x4003:
				case 0x4004:
				case 0x4005:
				case 0x4006:
				case 0x4007:
				case 0x4008:
				case 0x400A:
				case 0x400B:
				case 0x400C:
				case 0x400D:
				case 0x400E:
				case 0x400F:
				case 0x4010:
				case 0x4011:
				case 0x4012:
				case 0x4013:
				case 0x4014:
				case 0x4015:
					this.nsf.apu.SetRegister(address, value);
					break;
				case 0x5FF8:
				case 0x5FF9:
				case 0x5FFA:
				case 0x5FFB:
				case 0x5FFC:
				case 0x5FFD:
				case 0x5FFE:
				case 0x5FFF:
					this.nsf.nsfFile.SwitchBank(address, value);
					break;
			}
		} else if (address > 0x7FFF) {
			this.nsf.apu.SetExpansionAudio(address, value);
		}
	}
	//#endregion 获取或设置内存某个的值

	//#region 入栈和出栈
	/**
	 * 入栈
	 * @param value 要入栈的值
	 * @param length 入栈字节数
	 */
	private DataPush(value: number, length: number) {
		let temp = 0;
		if (length == 2) {
			this.memory[this.register_S + 0x100] = (value >> 8) & 0xFF;
			temp = 1;
		}
		this.memory[this.register_S + 0x100 - temp] = value & 0xFF;
		this.register_S -= length;
	}

	/**
	 * 出栈
	 * @param length 出栈字节数
	 */
	private DataPull(length: number): number {
		let result = this.memory[this.register_S + 0x101];

		if (length == 2)
			result += this.memory[this.register_S + 0x102] << 8;

		this.register_S += length;
		return result;
	}
	//#endregion 入栈和出栈

	//#region 读取和设定标志位值
	private ReadRegisterP(): number {
		let result = 0;
		let temp = 1;
		for (let i = 0; i < 8; i++) {
			if (this.flags[i])
				result |= temp;

			temp <<= 1;
		}
		return result;
	}

	/**
	 * 直接设置标志位P
	 * @param value 设定值
	 */
	private SetRegisterP(value: number) {
		let temp = value;
		for (let loop = 0; loop < 8; loop++) {
			this.flags[loop] = (temp & 1) == 1;
			temp >>= 1;
		}
		this.register_P = value;
	}
	//#endregion 读取和设定标志位值

	/**
	 * 获取时钟
	 */
	public AddClock(clock: number) {
		this.clock = clock;
	}

	/**
	 * CPU执行一个操作
	 * @returns CPU时钟
	 */
	public OneOperation(): number {
		if (this.doNothingMode)
			return 2;

		let opNum: number = this.GetMemoryData(this.register_PC, 1);
		this.DoOperation(opNum);
		return this.clock;
	}

	/**重置CPU内存 */
	public ResetMemory() {
		this.memory = new Uint8Array(0x8000);
		for (let i = 0; i < this.memory.length; i++) {
			this.memory[i] = 0;
		}
	}
}