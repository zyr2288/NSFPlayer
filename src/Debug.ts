class Debug {
	static ele: HTMLElement;

	static UpdateEle(value: any) {
		if (!Debug.ele)
			return;

		let temp2 = Debug.ele.innerText.split("\n");
		let temp = "";
		let max = 30;
		if (temp2.length > max) {
			temp = "";
			for (let index = 0; index < temp2.length - 2; index++) {
				temp += this.GetMark(temp2[index].length) + "\n";
			}
			temp = this.GetMark(value) + "\n" + temp;
		} else {
			temp = this.GetMark(value) + "\n" + Debug.ele.innerText;
		}

		Debug.ele.innerText = temp;
	}

	static GetMark(value: number): string {
		let result = "";

		for (let index = 0; index < value; index++) {
			result += "|";
		}

		return result;
	}
}