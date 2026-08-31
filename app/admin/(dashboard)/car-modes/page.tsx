import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { useToast } from '@/components/use-tooltip'
import { addCircle, pencil, trash } from 'lucide-react'

export default function CarModesPage() {
  const [modes, setModes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingMode, setEditingMode] = useState<any | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadModes()
  }, [])

  async function loadModes() {
    setIsLoading(true)
    try {
      const data = await fetchCarModes()
      setModes(data)
    } catch (err) {
      console.error('Failed to load modes', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave(mode: any) {
    setIsLoading(true)
    try {
      await saveCarMode(mode)
      loadModes()
      setShowForm(false)
      showToast('Mode saved successfully')
    } catch (err) {
      console.error('Failed to save mode', err)
      showToast('Failed to save mode', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleteId(id)
  }

  async function confirmDelete() {
    if (!deleteId) return
    setIsLoading(true)
    try {
      await deleteCarMode(deleteId)
      loadModes()
      setDeleteId(null)
      setShowForm(false)
      showToast('Mode deleted successfully')
    } catch (err) {
      console.error('Failed to delete mode', err)
      showToast('Failed to delete mode', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Car Modes</h2>
        <Button
          onClick={() => setShowForm(true)}
          className="ml-auto flex items-center gap-2"
        >
          <addCircle className="h-4 w-4" /> Add Mode
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading modes...</p>
        ) : modes.length === 0 ? (
          <p>No modes found. Add a new mode above.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Token</TableCell>
                <TableCell>Device Index</TableCell>
                <TableCell>Car Type</TableCell>
                <TableCell>Controls</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHeader>
            {modes.map((mode) => (
              <TableRow key={mode.id}>
                <TableCell>{mode.name}</TableCell>
                <TableCell>{mode.token}</TableCell>
                <TableCell>{mode.deviceIndex}</TableCell>
                <TableCell>{mode.car}</TableCell>
                <TableCell>
                  {mode.controls.map((c: string) => (<span key={c} className="badge">{c}</span>))}
                </TableCell>
                <TableCell>
                  <Button
                    onClick={() => handleDelete(mode.id)}
                    variant="destructive"
                    size="icon"
                  >
                    <trash />
                  </Button>
                  <Button
                    onClick={() => setEditingMode(mode)}
                    variant="outline"
                    size="default"
                  >
                    <pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function showToast(message: string, variant?: 'error' | 'success') {
  const { title, description } = variant === 'error' ? { title: 'Error', description: message } : { title: 'Success', description: message }
  useToast({ title, description })
}