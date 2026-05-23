export default function StatCard({ label, value, change, icon: Icon, accent = 'primary' }) {
  const accents = {
    primary: 'from-primary-500 to-primary-700',
    green: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    violet: 'from-violet-500 to-violet-700',
  };

  return (
    <div className="card p-5 relative overflow-hidden group hover:shadow-premium-lg transition-shadow">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br ${accents[accent]} opacity-10 group-hover:opacity-20 transition-opacity`} />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-sm font-medium text-surface-500">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          {change && <p className="text-xs text-emerald-600 font-medium mt-1">{change}</p>}
        </div>
        {Icon && (
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accents[accent]} flex items-center justify-center text-white shadow-lg`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
