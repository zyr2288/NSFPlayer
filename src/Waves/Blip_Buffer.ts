/********** .H文件定义 **********/
const BLIP_PHASE_BITS = 6;
const blip_widest_impulse_ = 16;
const blip_res = 1 << BLIP_PHASE_BITS;

const blip_sample_bits = 30;

/********** .CPP文件定义 **********/
const buffer_extra = blip_widest_impulse_ + 2;
const LONG_MAX = 2147483647;
const ULONG_MAX = 0xffffffff;
const BLIP_BUFFER_ACCURACY = 16;

const blip_max_length = 0;
const blip_default_length = 250;

export class Blip_Buffer {

	factor_ = LONG_MAX;
	offset_ = 0;
	buffer_ = 0;
	buffer_size_ = 0;
	sample_rate_ = 0;
	reader_accum = 0;
	bass_shift = 0;
	clock_rate_ = 0;
	bass_freq_ = 16;
	length_ = 0;

	Clear(entire_buffer: number = 1) {
		this.offset_ = 0;
		this.reader_accum = 0;
		// if ( buffer_ )
		// {
		// 	long count = (entire_buffer ? buffer_size_ : samples_avail());
		// 	memset( buffer_, 0, (count + buffer_extra) * sizeof (buf_t_) );
		// }
	}

	Set_Sample_Rate(new_rate: number, msec: number) {
		let new_size = (ULONG_MAX >> BLIP_BUFFER_ACCURACY) - buffer_extra - 64;
		if (msec != blip_max_length) {
			let s = (new_rate * (msec + 1) + 999) / 1000;
			if (s < new_size)
				new_size = s;

		}

		this.buffer_size_ = new_size;

		this.sample_rate_ = new_rate;
		this.length_ = new_size * 1000 / new_rate - 1;

		if (this.clock_rate_)
			this.Clock_Rate(this.clock_rate_);

		this.Bass_Freq(this.bass_freq_);

		this.Clear();

		return 0;	// success
	}

	Clock_Rate_Factor(clock_rate: number): number {
		let ratio = this.sample_rate_ / clock_rate;
		let factor = Math.floor(ratio * (1 << BLIP_BUFFER_ACCURACY) + 0.5);
		return factor;
	}

	Bass_Freq(freq: number) {
		this.bass_freq_ = freq;
		let shift = 31;
		if (freq > 0) {
			shift = 13;
			let f = (freq << 16) / this.sample_rate_;
			while ((f >>= 1) && --shift) { }
		}
		this.bass_shift = shift;
	}

	End_Frame(t: number) {
		this.offset_ += t * this.factor_;
	}

	Remove_Silence(count: number) {
		this.offset_ -= count << BLIP_BUFFER_ACCURACY;
	}

	Count_Samples(t: number): number {
		let last_sample = this.Resampled_Time(t) >> BLIP_BUFFER_ACCURACY;
		let first_sample = this.offset_ >> BLIP_BUFFER_ACCURACY;
		return last_sample - first_sample;
	}

	Count_Clocks(count: number): number {
		if (count > this.buffer_size_)
			count = this.buffer_size_;

		let time = count << BLIP_BUFFER_ACCURACY;
		return Math.floor((time - this.offset_ + this.factor_ - 1) / this.factor_);
	}

	Remove_Samples(count: number) {
		if (count) {
			this.Remove_Silence(count);
		}
	}

	Read_Samples(out: number[], max_samples: number, stereo: number): number {
		let count = this.Samples_Avail();
		if (count > max_samples)
			count = max_samples;

		if (count) {
			let sample_shift = blip_sample_bits - 16;
			let bass_shift = this.bass_shift;
			let accum = this.reader_accum;
			let inn = this.buffer_;

			if (!stereo) {
				for (let n = count, i = 0; n--; i++) {
					let s = accum >> sample_shift;
					accum -= accum >> bass_shift;
					accum += inn++;
					out[i] = s;

					// clamp sample
					if ((s & 0xFFFF) != s)
						out[i - 1] = 0x7FFF - (s >> 24);
				}
			} else {
				for (let n = count, i = 0; n--; i += 2) {
					let s = accum >> sample_shift;
					accum -= accum >> bass_shift;
					accum += inn++;
					out[i] += s;

					// clamp sample
					if ((s & 0xFFFF) != s)
						out[i - 2] = 0x7FFF - (s >> 24);
				}
			}

			this.reader_accum = accum;
			this.Remove_Samples(count);
		}
		return count;
	}

	Mix_Samples(inn: number[], count: number) {
		let out = this.buffer_ + (this.offset_ >> BLIP_BUFFER_ACCURACY) + blip_widest_impulse_ / 2;

		let sample_shift = blip_sample_bits - 16;
		let prev = 0;
		let i = 0;
		while (count--) {
			let s = inn[i++] << sample_shift;
		* out += s - prev;
			prev = s;
			++out;
		}
	* out -= prev;
	}

	/********** .H文件 **********/
	Clock_Rate(cps: number) {
		this.factor_ = this.Clock_Rate_Factor(this.clock_rate_ = cps);
	}

	Resampled_Time(t: number): number {
		return t * this.factor_ + this.offset_;
	}

	Samples_Avail() {
		return this.offset_ >> BLIP_BUFFER_ACCURACY;
	}
}

export class Blip_Synth_ {

	impulses: number[];
	width: number;

	volume_unit_ = 0.0;
	kernel_unit = 0;
	buf = 0;
	last_amp = 0;
	delta_factor = 0;

	constructor(p: number[], w: number) {
		this.impulses = p;
		this.width = w;
	}

	Adjust_Impulse() {
		let size = this.Impulses_Size();
		for (let p = blip_res; p-- > blip_res / 2;) {
			let p2 = blip_res - 2 - p;
			let error = this.kernel_unit;
			for (let i = 1; i < size; i += blip_res) {
				error -= this.impulses[i + p];
				error -= this.impulses[i + p2];
				if (p == p2)
					error /= 2;

				this.impulses[size - blip_res + p] += error;
			}
		}
	}

	Treble_Eq(eq: Blip_Eq_T) {
		let fimpulse = new Array(blip_res / 2 * (blip_widest_impulse_ - 1) + blip_res * 2);
		let half_size = blip_res / 2 * (this.width - 1);
		eq.Generate(fimpulse, half_size);

		let i;
		for (i = blip_res; i--;)
			fimpulse[blip_res + half_size + i] = fimpulse[blip_res + half_size - 1 - i];

		for (i = 0; i < blip_res; i++)
			fimpulse[i] = 0;

		let total = 0;
		for (i = 0; i < half_size; i++)
			total += fimpulse[blip_res + i];

		let base_unit = 32768;
		let rescale = base_unit / 2 / total;
		this.kernel_unit = base_unit;

		let sum = 0;
		let next = 0;
		let impulses_size = this.Impulses_Size();
		for (i = 0; i < impulses_size; i++) {
			this.impulses[i] = Math.floor((next - sum) * rescale + 0.5);
			sum += fimpulse[i];
			next += fimpulse[i + blip_res];
		}

		this.Adjust_Impulse();

		let vol = this.volume_unit_;
		if (vol) {
			this.volume_unit_ = 0;
			this.Volume_Unit(vol);
		}
	}

	Volume_Unit(new_unit: number) {
		if (new_unit != this.volume_unit_) {
			// use default eq if it hasn't been set yet
			if (!this.kernel_unit)
				this.Treble_Eq(new Blip_Eq_T(-8.0));

			this.volume_unit_ = new_unit;
			let factor = new_unit * (1 << blip_sample_bits) / this.kernel_unit;

			if (factor > 0) {
				let shift = 0;

				// if unit is really small, might need to attenuate kernel
				while (factor < 2.0) {
					shift++;
					factor *= 2.0;
				}

				if (shift) {
					this.kernel_unit >>= shift;
					// assert(kernel_unit > 0); // fails if volume unit is too low

					// keep values positive to avoid round-towards-zero of sign-preserving
					// right shift for negative values
					let offset = 0x8000 + (1 << (shift - 1));
					let offset2 = 0x8000 >> shift;
					for (let i = this.Impulses_Size(); i--;)
						this.impulses[i] = (((this.impulses[i] + offset) >> shift) - offset2);
					this.Adjust_Impulse();
				}
			}

			this.delta_factor = Math.floor(factor + 0.5);
			//printf( "delta_factor: %d, kernel_unit: %d\n", delta_factor, kernel_unit );
		}
	}

	/********** .H文件 **********/
	private Impulses_Size() {
		return Math.floor(blip_res / 2 * this.width + 1);
	}
}

export class Blip_Eq_T {

	treble: number;
	rolloff_freq: number;
	sample_rate: number;
	cutoff_freq: number;

	constructor(treble: number, rolloff_freq: number = 0, sample_rate: number = 44100, cutoff_freq: number = 0) {
		this.treble = treble;
		this.rolloff_freq = rolloff_freq;
		this.sample_rate = sample_rate;
		this.cutoff_freq = cutoff_freq;
	}

	Generate(out: number[], count: number) {
		let oversample = blip_res * 2.25 / count + 0.85;
		let half_rate = this.sample_rate * 0.5;
		if (this.cutoff_freq)
			oversample = half_rate / this.cutoff_freq;

		let cutoff = this.rolloff_freq * oversample / half_rate;
		Utils.Gen_Sinc(out, count, blip_res * oversample, this.treble, cutoff);
	}
}

class Utils {
	static Gen_Sinc(out: number[], count: number, oversample: number, treble: number, cutoff: number) {
		if (cutoff >= 0.999)
			cutoff = 0.999;

		if (treble < -300.0)
			treble = -300.0;
		if (treble > 5.0)
			treble = 5.0;

		let maxh = 4096.0;
		let rolloff = Math.pow(10.0, 1.0 / (maxh * 20.0) * treble / (1.0 - cutoff));
		let pow_a_n = Math.pow(rolloff, maxh - maxh * cutoff);
		let to_angle = Math.PI / 2 / maxh / oversample;
		for (let i = 0; i < count; i++) {
			let angle = ((i - count) * 2 + 1) * to_angle;
			let c = rolloff * Math.cos((maxh - 1.0) * angle) - Math.cos(maxh * angle);
			let cos_nc_angle = Math.cos(maxh * cutoff * angle);
			let cos_nc1_angle = Math.cos((maxh * cutoff - 1.0) * angle);
			let cos_angle = Math.cos(angle);

			c = c * pow_a_n - rolloff * cos_nc1_angle + cos_nc_angle;
			let d = 1.0 + rolloff * (rolloff - cos_angle - cos_angle);
			let b = 2.0 - cos_angle - cos_angle;
			let a = 1.0 - cos_angle - cos_nc_angle + cos_nc1_angle;

			out[i] = ((a * d + c * b) / (b * d)); // a / b + c / d
		}
	}
}