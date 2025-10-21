class Thing {
	constructor() {
		// number of rows in the grid (vertical partitioning)
		this.rows = 15;
		// padding from the edges
		this.pad = 2;
		// base amplitude for wiggle
		this.baseAmp = 10;
		// noise detail
		noiseDetail(2, 0.5);
		// seed so each Thing is stable
		this.seed = random(1000);
	}

	// draw the entire grid of lines
	draw() {
		push();
		translate(0, 0);
		stroke(0);
		noFill();

		const w = width - this.pad * 2;
		const h = height - this.pad * 2;

		// spacing between rows (horizontal stripes)
		const rowH = h / this.rows;

		// Vertical lines: increasing count from left to right, maximum equals rows
		// but the user asked: "increasing number of vertical not straight lines from the left side" -> interpret as per row, leftmost row has 1 vertical line, next row 2, ...
		// We'll draw vertical sets per row band, spaced across the grid width based on the number in the last row.

		// Horizontal lines: increasing count from bottom to top, adding one line per row of the grid.

		for (let r = 0; r < this.rows; r++) {
			const yTop = this.pad + r * rowH;
			const yBottom = yTop + rowH;

			// For each row we draw the horizontal line(s). The spec says add one line per row of the grid —
			// we'll draw r+1 horizontal wiggly lines between yTop and yBottom, distributed evenly in that band.
			const horizCount = r + 1;
			for (let hi = 0; hi < horizCount; hi++) {
				const y = lerp(yBottom, yTop, hi / (horizCount - 1 || 1));
				this._drawWigglyHorizontal(y, r, h);
			}

			// Vertical lines for this row: increase by row index as well.
			const vertCount = r + 1; // leftmost band has 1, increasing to the right
			// We must space vertical lines based on the number of lines filling the last row of each direction
			// Interpret as: full width uses `this.rows` as max vertical density; here compute positions across width
			for (let vi = 0; vi < vertCount; vi++) {
				// map vi across the left portion of the canvas — but spec said "from the left side" so we bias positions toward left
				// We'll place vertical lines across the full width but denser on the left by squaring the normalized position.
				const t = vi / (vertCount - 1 || 1);
				const biasedT = pow(t, 1.6); // bias toward 0 (left)
				const x = this.pad + biasedT * w;
				this._drawWigglyVertical(x, r, w);
			}
		}

		pop();
	}

	// Draw a horizontally-oriented wiggly line across the width at y
	_drawWigglyHorizontal(y, rowIndex, gridHeight) {
		const amp = this._computeAmp(y);
		const detail = 120; // number of samples along the line
		beginShape();
		for (let i = 0; i <= detail; i++) {
			const t = i / detail;
			const x = lerp(this.pad, width - this.pad, t);
			// noise seed mixes rowIndex, x and global seed
			const n = noise(this.seed + rowIndex * 0.1 + x * 0.005, y * 0.005, frameCount * 0.005);
			const wig = map(n, 0, 1, -amp, amp);
			// if mouse is near this point, add extra wiggle
			const d = dist(mouseX, mouseY, x, y);
			const extra = this._mouseInfluence(d) * amp * 1.5;
			curveVertex(x, y + wig + extra);
		}
		endShape();
	}

	// Draw a vertically-oriented wiggly line down the height at x
	_drawWigglyVertical(x, colIndex, gridWidth) {
		const amp = this._computeAmp(x);
		const detail = 120;
		beginShape();
		for (let i = 0; i <= detail; i++) {
			const t = i / detail;
			const y = lerp(this.pad, height - this.pad, t);
			const n = noise(this.seed + colIndex * 0.005 + y * 0.005, x * 0.05, frameCount * 0.1);
			const wig = map(n, 0, 1, -amp, amp);
			const d = dist(mouseX, mouseY, x, y);
			const extra = this._mouseInfluence(d) * amp * 2.5;
			curveVertex(x + wig + extra, y);
		}
		endShape();
	}

	// compute amplitude, scale with window size and mouse
	_computeAmp(pos) {
		// base amplitude scaled by canvas size
		const scale = (width + height) / 1000;
		return this.baseAmp * scale;
	}

	// mouse influence falls off with distance; returns 0..1
	_mouseInfluence(distToPoint) {
		const falloff = 80; // pixels
		return max(0, 0.5 - distToPoint / falloff);
	}
}