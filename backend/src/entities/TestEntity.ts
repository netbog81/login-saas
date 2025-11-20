import { Entity, Column, Check } from "typeorm";

@Entity("test_table")
export class TestEntity {
    @Column()
    @Check("CHK_test_condition", '"endTime" > "startTime"')
    testField: string;
}
