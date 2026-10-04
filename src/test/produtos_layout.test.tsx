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
});
