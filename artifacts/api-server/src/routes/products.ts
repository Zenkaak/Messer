import { Router, type IRouter } from "express";
import { eq, and, ilike, asc, desc, sql, count, gte, lte } from "drizzle-orm";
import { db, productsTable, categoriesTable, insertProductSchema } from "@workspace/db";

const router: IRouter = Router();

router.get("/products", async (req, res) => {
  try {
    const { search, category, category_id, featured, in_stock, sort, page, limit, min_price, max_price } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * pageSize;

    const conditions: ReturnType<typeof eq>[] = [];

    let relevanceOrderSQL: ReturnType<typeof sql> | null = null;
    let searchNormalized = '';

    if (search && typeof search === "string" && search.trim()) {
      const raw = search.trim();
      const normalized = raw
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();
      searchNormalized = normalized;

      const words = normalized.split(' ').filter(w => w.length > 1);
      const hasMultipleWords = words.length > 1;
      const { or } = await import('drizzle-orm');

      if (hasMultipleWords) {
        const exactCond = ilike(productsTable.name, `%${normalized}%`);
        const wordConds = words.flatMap(word => [
          ilike(productsTable.name, `%${word}%`),
          ilike(productsTable.description, `%${word}%`),
        ]);
        conditions.push(or(exactCond, ...wordConds) as never);
        relevanceOrderSQL = sql`CASE WHEN ${ilike(productsTable.name, `%${normalized}%`)} THEN 0 ELSE 1 END`;
      } else {
        const terms = [...new Set([raw, normalized])].filter(Boolean);
        const searchConditions = terms.flatMap(term => [
          ilike(productsTable.name, `%${term}%`),
          ilike(productsTable.description, `%${term}%`),
        ]);
        conditions.push(or(...searchConditions) as never);
      }
    }
    if (category && typeof category === "string") {
      const [cat] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.slug, category));
      if (cat) conditions.push(eq(productsTable.categoryId, cat.id));
      else {
        res.json({ products: [], total: 0, totalPages: 0 });
        return;
      }
    }
    if (category_id) {
      conditions.push(eq(productsTable.categoryId, Number(category_id)));
    }
    if (featured !== undefined) {
      conditions.push(eq(productsTable.featured, featured === "true"));
    }
    if (in_stock !== undefined) {
      conditions.push(eq(productsTable.inStock, in_stock === "true"));
    }
    if (min_price !== undefined && !isNaN(Number(min_price))) {
      conditions.push(gte(sql`CAST(${productsTable.price} AS numeric)`, Number(min_price)) as never);
    }
    if (max_price !== undefined && !isNaN(Number(max_price))) {
      conditions.push(lte(sql`CAST(${productsTable.price} AS numeric)`, Number(max_price)) as never);
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(productsTable)
      .where(whereClause);

    let orderByClause;
    switch (sort) {
      case "price_asc":
        orderByClause = asc(sql`CAST(${productsTable.price} AS numeric)`);
        break;
      case "price_desc":
        orderByClause = desc(sql`CAST(${productsTable.price} AS numeric)`);
        break;
      case "popular":
        orderByClause = desc(productsTable.featured);
        break;
      default:
        orderByClause = desc(productsTable.createdAt);
    }

    const rows = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        imageUrl: productsTable.imageUrl,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(whereClause)
      .orderBy(...(relevanceOrderSQL ? [relevanceOrderSQL, orderByClause] : [orderByClause]))
      .limit(pageSize)
      .offset(offset);

    const products = rows.map((r) => ({
      ...r,
      price: parseFloat(r.price),
      originalPrice: r.originalPrice ? parseFloat(r.originalPrice) : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    }));

    const relatedStartIndex = relevanceOrderSQL && searchNormalized
      ? products.filter(p => p.name.toLowerCase().includes(searchNormalized.toLowerCase())).length
      : undefined;
    res.json({ products, total, totalPages: Math.ceil(total / pageSize), ...(relatedStartIndex !== undefined ? { relatedStartIndex } : {}) });
  } catch (err) {
    req.log.error({ err }, "Failed to list products");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/products", async (req, res) => {
  try {
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [product] = await db.insert(productsTable).values(parsed.data).returning();
    const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
    res.status(201).json({
      ...product,
      price: parseFloat(product.price),
      originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : null,
      categoryName: cat?.name ?? null,
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create product");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        price: productsTable.price,
        originalPrice: productsTable.originalPrice,
        imageUrl: productsTable.imageUrl,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(eq(productsTable.id, id));

    if (!rows.length) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const r = rows[0];
    res.json({
      ...r,
      price: parseFloat(r.price),
      originalPrice: r.originalPrice ? parseFloat(r.originalPrice) : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get product");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [product] = await db.update(productsTable).set(parsed.data).where(eq(productsTable.id, id)).returning();
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
    res.json({
      ...product,
      price: parseFloat(product.price),
      originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : null,
      categoryName: cat?.name ?? null,
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update product");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete product");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
