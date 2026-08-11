<script lang="ts">
	interface Props {
		data: number[];
		color?: string;
		gradientId?: string;
		yLabel?: string;
		formatY?: (v: number) => string;
		height?: number;
	}

	let {
		data,
		color = '#0ea5e9',
		gradientId = 'chartGrad',
		yLabel = '',
		formatY = (v: number) => v.toFixed(2),
		height = 240
	}: Props = $props();

	const viewWidth = 700;
	const pad = { top: 24, right: 20, bottom: 38, left: 68 };
	const plotW = viewWidth - pad.left - pad.right;
	const plotH = height - pad.top - pad.bottom;

	function niceScale(min: number, max: number, count: number = 5) {
		const range = max - min || 1;
		const rough = range / count;
		const mag = Math.pow(10, Math.floor(Math.log10(rough)));
		const norm = rough / mag;
		const step = norm <= 1.5 ? mag : norm <= 3.5 ? 2 * mag : norm <= 7.5 ? 5 * mag : 10 * mag;
		const lo = Math.floor(min / step) * step;
		const hi = Math.ceil(max / step) * step;
		const ticks: number[] = [];
		for (let v = lo; v <= hi + step * 0.01; v += step) ticks.push(v);
		return { min: lo, max: hi, ticks };
	}

	let yMin = $derived(Math.min(...data));
	let yMax = $derived(Math.max(...data));
	let scale = $derived(niceScale(yMin, yMax));

	function x(i: number) {
		return pad.left + (i / Math.max(data.length - 1, 1)) * plotW;
	}
	function y(v: number) {
		const range = scale.max - scale.min || 1;
		return pad.top + (1 - (v - scale.min) / range) * plotH;
	}

	let pathD = $derived(
		data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
	);

	let areaD = $derived(
		pathD + ` L${x(data.length - 1).toFixed(1)},${(pad.top + plotH).toFixed(1)} L${pad.left},${(pad.top + plotH).toFixed(1)} Z`
	);

	let hoverIdx = $state(-1);

	function handleMouseMove(e: MouseEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const mouseX = ((e.clientX - rect.left) / rect.width) * viewWidth;
		const idx = Math.round(((mouseX - pad.left) / plotW) * (data.length - 1));
		hoverIdx = Math.max(0, Math.min(data.length - 1, idx));
	}
</script>

<svg
	viewBox="0 0 {viewWidth} {height}"
	class="w-full select-none"
	role="img"
	onmousemove={handleMouseMove}
	onmouseleave={() => (hoverIdx = -1)}
>
	<defs>
		<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color={color} stop-opacity="0.15" />
			<stop offset="100%" stop-color={color} stop-opacity="0" />
		</linearGradient>
	</defs>

	<!-- Grid lines -->
	{#each scale.ticks as tick}
		<line
			x1={pad.left}
			x2={viewWidth - pad.right}
			y1={y(tick)}
			y2={y(tick)}
			stroke="currentColor"
			stroke-opacity="0.07"
		/>
		<text
			x={pad.left - 10}
			y={y(tick) + 4}
			text-anchor="end"
			fill="currentColor"
			fill-opacity="0.35"
			font-size="11"
			font-family="ui-monospace, monospace">{formatY(tick)}</text
		>
	{/each}

	<!-- X axis ticks -->
	{#each [0, Math.round(data.length * 0.25), Math.round(data.length * 0.5), Math.round(data.length * 0.75), data.length - 1] as epoch}
		<text
			x={x(epoch)}
			y={height - pad.bottom + 22}
			text-anchor="middle"
			fill="currentColor"
			fill-opacity="0.35"
			font-size="11">{epoch + 1}</text
		>
	{/each}

	<!-- Area fill -->
	<path d={areaD} fill="url(#{gradientId})" />

	<!-- Data line -->
	<path d={pathD} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" />

	<!-- Hover indicator -->
	{#if hoverIdx >= 0}
		<line
			x1={x(hoverIdx)}
			x2={x(hoverIdx)}
			y1={pad.top}
			y2={pad.top + plotH}
			stroke={color}
			stroke-opacity="0.25"
			stroke-width="1"
		/>
		<circle cx={x(hoverIdx)} cy={y(data[hoverIdx])} r="5" fill={color} opacity="0.2" />
		<circle cx={x(hoverIdx)} cy={y(data[hoverIdx])} r="3" fill={color} />
		<rect
			x={Math.min(Math.max(x(hoverIdx) - 76, 0), viewWidth - 152)}
			y={Math.max(y(data[hoverIdx]) - 32, 0)}
			width="152"
			height="22"
			rx="6"
			fill="var(--color-paper)"
			stroke="var(--color-rule)"
			stroke-width="1"
		/>
		<text
			x={Math.min(Math.max(x(hoverIdx), 76), viewWidth - 76)}
			y={Math.max(y(data[hoverIdx]) - 17, 15)}
			text-anchor="middle"
			fill="currentColor"
			font-size="11"
			font-family="ui-monospace, monospace"
		>
			Epoch {hoverIdx + 1}: {formatY(data[hoverIdx])}
		</text>
	{/if}

	<!-- Axis labels -->
	<text
		x={viewWidth / 2}
		y={height - 4}
		text-anchor="middle"
		fill="currentColor"
		fill-opacity="0.35"
		font-size="12">Epoch</text
	>
	{#if yLabel}
		<text
			x={16}
			y={height / 2}
			text-anchor="middle"
			fill="currentColor"
			fill-opacity="0.35"
			font-size="12"
			transform="rotate(-90, 16, {height / 2})">{yLabel}</text
		>
	{/if}
</svg>
