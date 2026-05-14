import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, categoriesTable, productsTable, insertCategorySchema } from "@workspace/db";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        productCount: count(productsTable.id),
      })
      .from(categoriesTable)
      .leftJoin(productsTable, eq(productsTable.categoryId, categoriesTable.id))
      .groupBy(categoriesTable.id, categoriesTable.name, categoriesTable.slug);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list categories");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [category] = await db.insert(categoriesTable).values(parsed.data).returning();
    res.status(201).json({ ...category, productCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        productCount: count(productsTable.id),
      })
      .from(categoriesTable)
      .leftJoin(productsTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(eq(categoriesTable.id, id))
      .groupBy(categoriesTable.id, categoriesTable.name, categoriesTable.slug);

    if (!rows.length) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [category] = await db.update(categoriesTable).set(parsed.data).where(eq(categoriesTable.id, id)).returning();
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const [{ productCount }] = await db
      .select({ productCount: count(productsTable.id) })
      .from(productsTable)
      .where(eq(productsTable.categoryId, id));
    res.json({ ...category, productCount });
  } catch (err) {
    req.log.error({ err }, "Failed to update category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
