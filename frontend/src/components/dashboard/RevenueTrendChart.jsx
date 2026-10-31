import { TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLORS } from '../../constants/chartColors.js'
import useTheme from '../../hooks/useTheme.js'
import Card from '../ui/Card.jsx'

function formatLakhs(value) {
  return `₹${Math.round(value)}L`
}

function formatLakhsPrecise(value) {
  return `₹${value.toFixed(1)}L`
}

export default function RevenueTrendChart({ data }) {
  const { theme } = useTheme()
  const colors = CHART_COLORS[theme]
  const latest = data[data.length - 1]
  const first = data[0]
  const growthPercent = first.value > 0 ? Math.round(((latest.value - first.value) / first.value) * 100) : 0

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Revenue Trend</h2>
          <p className="text-sm text-foreground-muted">Billed invoices per month, last 6 months</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-xs font-medium text-success-text ring-1 ring-inset ring-success/25">
          <TrendingUp size={14} aria-hidden="true" />
          +{growthPercent}% since {first.month}
        </span>
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatLakhsPrecise(latest.value)}
        </p>
        <p className="text-sm text-foreground-muted">Billed in {latest.month}</p>
      </div>

      <div className="mt-4 h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.primary} stopOpacity={0.16} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: colors.axis, fontSize: 12 }}
              dy={8}
            />
            <YAxis
              domain={['dataMin - 2', 'dataMax + 2']}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatLakhs}
              tick={{ fill: colors.axis, fontSize: 12 }}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: colors.grid }}
              formatter={(value) => [formatLakhsPrecise(value), 'Billed']}
              labelStyle={{ color: colors.foreground, fontWeight: 600 }}
              itemStyle={{ color: colors.foreground }}
              contentStyle={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                border: `1px solid ${colors.grid}`,
                fontSize: 13,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.primary}
              strokeWidth={2}
              fill="url(#revenueFill)"
              dot={{ r: 3, fill: colors.surface, stroke: colors.primary, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: colors.primary, stroke: colors.surface, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
