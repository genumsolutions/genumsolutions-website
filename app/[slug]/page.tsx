import PageShell from '../../components/PageShell'
import CategoryPage from '../../components/CategoryPage'
import { getProjectCategory, PROJECT_CATEGORIES } from '../../lib/project-catalog'

export default function CategoryDescriptionPage() {
  const category = getProjectCategory('robocar') ?? PROJECT_CATEGORIES[0]!

  return (
    <PageShell>
      <CategoryPage slug={category.slug} />
    </PageShell>
  )
}