'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'

interface PreviewRow {
  [key: string]: string
}

interface ImportResult {
  job_id: string
  total_rows: number
  inserted_count: number
  duplicate_count: number
  error_count: number
  truncated: boolean
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [phoneCol, setPhoneCol] = useState('')
  const [nameCol, setNameCol] = useState('')
  const [emailCol, setEmailCol] = useState('')
  const [sourceCol, setSourceCol] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, preview: 5 })
      const cols = parsed.meta.fields ?? []
      setHeaders(cols)
      setPreview(parsed.data as PreviewRow[])

      // Auto-detect columns
      const lower = cols.map(c => c.toLowerCase())
      setPhoneCol(cols[lower.findIndex(c => c.includes('tel') || c.includes('phone') || c.includes('gsm'))] ?? '')
      setNameCol(cols[lower.findIndex(c => c.includes('isim') || c.includes('ad') || c.includes('name'))] ?? '')
      setEmailCol(cols[lower.findIndex(c => c.includes('email') || c.includes('mail'))] ?? '')
      setSourceCol(cols[lower.findIndex(c => c.includes('kaynak') || c.includes('source'))] ?? '')
    }
    reader.readAsText(f, 'UTF-8')
  }

  async function handleImport() {
    if (!file || !phoneCol) {
      setError('Dosya ve telefon kolonu seçilmeli')
      return
    }

    setLoading(true)
    setError('')

    const form = new FormData()
    form.append('file', file)
    form.append('phone_col', phoneCol)
    if (nameCol) form.append('name_col', nameCol)
    if (emailCol) form.append('email_col', emailCol)
    form.append('source_col', sourceCol || 'import')

    const res = await fetch('/api/import', { method: 'POST', body: form })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Import başarısız')
      return
    }

    setResult(data)
  }

  function reset() {
    setFile(null)
    setHeaders([])
    setPreview([])
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">CSV Lead Import</h1>
        <p className="text-sm text-slate-500 mt-0.5">Maksimum 500 satır. Duplicate'ler telefon veya e-posta ile tespit edilir.</p>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              <p className="font-semibold text-green-800">Import tamamlandı!</p>
            </div>
            <button onClick={reset} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs text-slate-500">Eklendi</p>
              <p className="text-xl font-bold text-green-700">{result.inserted_count}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs text-slate-500">Duplicate</p>
              <p className="text-xl font-bold text-amber-600">{result.duplicate_count}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <p className="text-xs text-slate-500">Hata</p>
              <p className={`text-xl font-bold ${result.error_count > 0 ? 'text-red-600' : 'text-slate-400'}`}>{result.error_count}</p>
            </div>
          </div>
          {result.truncated && (
            <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠️ Dosya 500 satırdan fazla içeriyor, sadece ilk 500 satır işlendi.
            </p>
          )}
        </div>
      )}

      {/* Upload area */}
      {!result && (
        <>
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={24} className="text-brand-500" />
                <div className="text-left">
                  <p className="font-medium text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload size={32} className="mx-auto text-slate-300" />
                <p className="text-sm text-slate-500">CSV dosyasını seçmek için tıklayın</p>
                <p className="text-xs text-slate-400">Desteklenen format: .csv (UTF-8)</p>
              </div>
            )}
          </div>

          {/* Column mapping */}
          {headers.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Kolon Eşleştirme</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Telefon *', value: phoneCol, setter: setPhoneCol },
                  { label: 'Ad Soyad', value: nameCol, setter: setNameCol },
                  { label: 'E-posta', value: emailCol, setter: setEmailCol },
                  { label: 'Kaynak', value: sourceCol, setter: setSourceCol },
                ].map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                    <select
                      value={value}
                      onChange={e => setter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">— Seçin —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">İlk 5 Satır Önizleme</h3>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr>
                        {headers.map(h => (
                          <th key={h} className="px-3 py-1.5 text-left bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          {headers.map(h => (
                            <td key={h} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[120px] truncate">
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {file && headers.length > 0 && (
            <div className="flex justify-end gap-3">
              <button onClick={reset} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
                İptal
              </button>
              <button
                onClick={handleImport}
                disabled={loading || !phoneCol}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Import Ediliyor...
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    Import Başlat
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
