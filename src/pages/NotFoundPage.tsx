import { Link } from 'react-router-dom'
import { Card, EmptyState } from '../components/ui'

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState title="Stran ne obstaja">
        <Link to="/" className="font-semibold text-green-700 hover:underline">
          Nazaj na pregled
        </Link>
      </EmptyState>
    </Card>
  )
}
