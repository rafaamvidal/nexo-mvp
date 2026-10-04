import { describe, expect, it } from "vitest";
import * as React from "react";
import { render } from "@testing-library/react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

describe("Produtos Table & Scroll Container", () => {
  it("renderiza o container do Table com a classe containerClassName para scroll vertical", () => {
    const { container } = render(
      <Table containerClassName="max-h-[460px] md:max-h-[500px] overflow-y-auto">
        <TableHeader className="sticky top-0 z-10 bg-card/95">
          <TableRow>
            <TableHead>Nome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Item 1</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const outerContainer = container.querySelector(".overflow-y-auto");
    expect(outerContainer).not.toBeNull();
    expect(outerContainer?.className).toContain("max-h-[460px]");
    expect(outerContainer?.className).toContain("overflow-y-auto");

    const header = container.querySelector("thead");
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
  });

  it("renderiza colunas com classes responsivas e células compactas sem estourar a largura", () => {
    const { container } = render(
      <Table containerClassName="max-h-[460px] md:max-h-[500px] overflow-y-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="py-2.5 px-3">Nome</TableHead>
            <TableHead className="py-2.5 px-2 hidden md:table-cell">Categoria</TableHead>
            <TableHead className="py-2.5 px-3 text-right hidden sm:table-cell">Preço</TableHead>
            <TableHead className="py-2.5 px-3 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="py-2.5 px-3 font-semibold">
              <div className="flex items-center gap-1.5 min-w-0 max-w-[170px] sm:max-w-[210px] md:max-w-[240px] lg:max-w-[280px]">
                <span className="truncate" title="COBERTURA SAB. CHOC. AO LEITE VISC 3A4MILCP">
                  COBERTURA SAB. CHOC. AO LEITE VISC 3A4MILCP
                </span>
              </div>
            </TableCell>
            <TableCell className="py-2.5 px-2 hidden md:table-cell text-xs text-muted-foreground truncate max-w-[120px]">
              Doces
            </TableCell>
            <TableCell className="py-2.5 px-3 text-right hidden sm:table-cell">
              R$ 10,00
            </TableCell>
            <TableCell className="py-2.5 px-3 text-right whitespace-nowrap">
              <div className="inline-flex items-center justify-end gap-1">
                <button className="h-8 w-8 p-0">btn</button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const nameCell = container.querySelector(".truncate");
    expect(nameCell).not.toBeNull();
    expect(nameCell?.parentElement?.className).toContain("min-w-0");
    expect(nameCell?.parentElement?.className).toContain("max-w-[170px]");

    const hiddenMd = container.querySelectorAll(".hidden.md\\:table-cell");
    expect(hiddenMd.length).toBeGreaterThan(0);

    const actionBtn = container.querySelector(".h-8.w-8");
    expect(actionBtn).not.toBeNull();
  });
});
