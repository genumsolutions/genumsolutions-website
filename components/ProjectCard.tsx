'use client'

import Image from 'next/image'
import { useState } from 'react'

interface ProjectCardProps {
  product: {
    id: string
    name: string
    category: string
    priceLabel: string
    badge?: string
    note?: string
    description?: string
    image?: string
  }
  onDetail?: (id: string) => void
}

export function ProjectCard({ product, onDetail }: ProjectCardProps) {
  const [isHovering, setIsHovering] = useState(false)

  return (
    <div
      className`
        group
        rounded-2xl
        overflow-hidden
        border
        border-line
        bg-white
        shadow-sm
        transition-shadow
        hover:shadow-md
        ${isHovering ? 'scale-105 transition-transform' : ''}
      `
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Link
        href={`/products/${product.id}`}
        aria-label={`View ${product.name}`}
        className`relative
        block
        h-48
        overflow-hidden
        bg-ink
      `>
        <Image
          src={product.image || '/placeholder-robo-car.jpg'}
          alt={product.name}
          width={400}
          height={250}
          className`w-full h-full object-cover transition duration-500 hover:scale-105`
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        <span className="absolute bottom-3 left-4 text-xs font-black uppercase tracking-widest text-white">{product.category}</span>
      </Link>

      <div className="p-5 flex flex-col h-full">
        <h3 className="text-lg font-medium mb-2">{product.name}</h3>
        {product.badge && (
          <span
            className`
              inline-block
              rounded-full
              px-2
              py-1
              text-xs
              font-medium
              mt-1
              ${product.badge === '4wd4m'
                ? 'bg-indigo-100 text-indigo-800'
                : product.badge === '2wd1m'
                  ? 'bg-green-100 text-green-800'
                  : product.badge === 'self-balancing'
                    ? 'bg-purple-100 text-purple-800'
                    : product.badge === 'obstacle-us'
                      ? 'bg-red-100 text-red-800'
                      : product.badge === 'obstacle-ir'
                        ? 'bg-orange-100 text-orange-800'
                        : product.badge === 'website-client'
                          ? 'bg-orange-100 text-orange-800'
                          : product.badge === 'website-server'
                            ? 'bg-orange-100 text-orange-800'
                            : product.badge === 'path-follow'
                              ? 'bg-teal-100 text-teal-800'
                              : product.badge === 'rf-manual'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                          }
            `
          >
            {product.badge}
          </span>
        )}
        <p className="text-sm text-muted-foreground line-clamp-3">{product.note || product.description?.split('. ')[0] || ''}</p>
        {onDetail && (
          <button
            onClick={() => onDetail(product.id)}
            className`mt-3 text-sm text-primary underline hover:underline`
          >
            View Details
          </button>
        )}
      </div>
    </div>
  )
}