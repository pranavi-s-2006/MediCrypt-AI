const ACTION_BADGE = {
  login:               'badge-blue',
  register:            'badge-blue',
  upload_file:         'badge-teal',
  view_patient_records:'badge-purple',
  generate_qr:         'badge-orange',
  request_access:      'badge-yellow',
  access_approved:     'badge-green',
  access_rejected:     'badge-red',
  verify_doctor:       'badge-green',
  add_prescription:    'badge-teal',
}

export default function AuditLogTable({ logs }) {
  if (!logs?.length) {
    return (
      <div className="py-12 text-center text-slate-400">
        <p className="text-sm">No audit logs found.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {['Timestamp', 'User', 'Action', 'Resource', 'IP Address', 'Status'].map(h => (
              <th key={h} className="th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const isFailed = log.status === 'failed'
            return (
              <tr key={log._id} className={`tr ${isFailed ? 'bg-red-50/50' : ''}`}>
                <td className="td text-xs text-slate-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('en-IN')}
                </td>
                <td className="td">
                  <p className="text-xs font-mono text-slate-700">{log.user_id}</p>
                  {log.user_name && (
                    <p className="text-[10px] text-slate-400">{log.user_name}</p>
                  )}
                </td>
                <td className="td">
                  <span className={ACTION_BADGE[log.action] || 'badge-gray'}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="td">
                  <span className="text-xs text-slate-600">{log.resource}</span>
                  {log.resource_id && (
                    <p className="text-[10px] text-slate-400 font-mono">{log.resource_id}</p>
                  )}
                </td>
                <td className="td">
                  <span className={`text-xs font-mono ${isFailed ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                    {log.ip_address || '—'}
                  </span>
                </td>
                <td className="td">
                  <span className={isFailed ? 'badge-red' : 'badge-green'}>
                    {log.status || 'success'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
