import { Entity, PrimaryColumn, CreateDateColumn, UpdateDateColumn, BeforeInsert } from 'typeorm'
import { nanoid } from 'nanoid'

@Entity()
export class Base {

  @PrimaryColumn()
  id: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @BeforeInsert()
  addId(): void {
    this.id = this.id ? this.id : nanoid()
  }

}
