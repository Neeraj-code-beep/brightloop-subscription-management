import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_COLORS } from '../../constants/chartColors.js'
import useTheme from '../../hooks/useTheme.js'
import { formatINR } from '../../utils/format.js'
import Card from '../ui/Card.jsx'

function formatAxis(value) {
  return value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : `₹${Math.round(value / 1000)}K`
}

export default function RevenueChart({ data, showBilled }) {
  const { theme } = useTheme()
  const colors = CHART_COLORS[theme]

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Collections by month</h2>
        <p className="text-sm text-foreground-muted">
          {showBilled ? 'Billed invoices against payments received' : 'Payments received each month'}
        </p>
      </div>
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: colors.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatAxis} tick={{ fill: colors.axis, fontSize: 12 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip
              formatter={(value, name) => [formatINR(value), name]}
              contentStyle={{ backgroundColor: colors.surface, borderColor: colors.grid, borderRadius: 8, color: colors.foreground }}
              cursor={{ fill: colors.grid, opacity: 0.4 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: colors.axis }} />
            {showBilled && <Bar dataKey="billed" name="Billed" fill={colors.axis} radius={[4, 4, 0, 0]} />}
            <Bar dataKey="collected" name="Collected" fill={colors.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
